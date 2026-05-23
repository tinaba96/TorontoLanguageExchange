# Stripe 決済セットアップ

## 1. DB マイグレーション
Supabase SQL Editor で **順番通り** 実行する:

1. `database/payment.sql` — bookings に決済カラム追加（`stripe_payment_intent_id` / `teacher_payout_amount` / `platform_amount` / `system_amount` / `paid_at`、status に `paid`・`refunded` 追加）
2. `database/notification_triggers_payment.sql` — 通知トリガを決済対応に拡張（生徒・先生・管理者へ通知）
3. `database/slot_reservation.sql` — スロット予約ロック + 期限切れ自動クリーンアップ（**pg_cron 必須**）

※ `notifications.sql` と `notification_triggers.sql` が未実行ならそれらを先に。
※ `slot_reservation.sql` は **Database → Extensions** で `pg_cron` を有効化してから実行すること。

## スロット予約フロー（重要な設計変更）

「予約する」ボタン → 決済成功 までの間、スロットは **15分間ロック**される。

```
[生徒] 「予約する」押下
   ↓ RPC reserve_slots_for_booking() 単一トランザクション:
     - availability_slots を 'reserved' にロック（他の生徒が選べなくなる）
     - bookings を作成 (status='pending_payment', expires_at=now+15min)
   ↓
   ├─ 15分以内に決済成功
   │    Webhook → bookings.status='confirmed'、slot='booked' に遷移
   │    → 通知トリガが先生・管理者・生徒に「決済完了」通知
   │
   └─ 15分以内に決済しない
        cron が5分おきに走り、期限切れ pending_payment を 'cancelled' に
        スロットは 'available' に戻る（他の生徒が予約可能に）
        → 通知は一切飛ばない（先生・管理者にノイズなし）
```

### Phantom payment（決済が成功したが予約が存在しない）の処理
極稀なエッジケース: 15分タイムアウト後に Stripe からの決済成功通知が遅延到着した場合。
- Webhook は `bookings` レコードがない/cancelled の場合を検出
- Stripe API で**自動返金**を実行
- 全管理者に `[管理・要対応] 決済発生 / 自動返金` 通知を送る
- 返金失敗時は `[管理・要対応] ... / 自動返金失敗` で人間の介入を促す

## 通知ポリシー（誰に何が届くか）

| イベント | 生徒 | 先生 | 管理者 |
|---|---|---|---|
| 予約作成 (`pending_payment`) | — | ✅「予約が入りました (決済待ち)」 | ✅「[管理] 新しい予約」 |
| 決済成功 (`confirmed`) | ✅「決済が完了しました」 | ✅「予約が確定しました / 受取予定 $X」 | ✅「[管理] 決済完了」+ 分配額メタデータ |
| 決済失敗 | ✅「決済に失敗しました」+ 再決済リンク | — | ✅「[管理] 決済失敗」+ 理由 |
| 返金 (`refunded`) | ✅「返金が完了しました」 | ✅「予約が返金されました」 | ✅「[管理] 返金処理」 |
| キャンセル (`cancelled`) | ✅ | ✅ | ✅ |
| チャージバック (`dispute`) | — | — | ✅「[管理・要対応] チャージバック発生」 |
| 3日前リマインダ | ✅ | ✅ | — |
| 24時間前リマインダ | ✅ | ✅ | — |

すべての通知は `notifications` テーブルに保存され、`/notifications` ページと Header のベル（`NotificationDropdown`）にリアルタイムで反映される。

## 2. 環境変数
`.env.local` に以下が**必須**:
```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=...
```
- Stripe キー: ダッシュボード → Developers → API keys
- `STRIPE_WEBHOOK_SECRET`: ローカルでは `stripe listen` 起動時に表示される `whsec_xxx` をコピー
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase ダッシュボード → Project Settings → API → `service_role` キー

## 3. ローカルでの Webhook 転送
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
別タブで起動しっぱなしにする。出力された `whsec_xxx` を `.env.local` の `STRIPE_WEBHOOK_SECRET` に貼り付けて Next.js を再起動。

## 4. テスト決済
- 成功: `4242 4242 4242 4242` (任意の期限/CVC/郵便番号)
- 認証要求: `4000 0025 0000 3155`
- 拒否: `4000 0000 0000 0002`

## 5. 分配ロジック (70 / 15 / 15)
合計金額 (cents) に対して:
- `teacher_payout_amount = floor(price * 0.70)`
- `platform_amount       = floor(price * 0.15)`
- `system_amount         = 残り` ← Stripe 手数料 (~2.9% + $0.30) を吸収

実際の Stripe 手数料は決済プロバイダ側で自動的に差し引かれて運営の Stripe 残高に入金されるので、`system_amount` は記録上の値。**現状は Stripe Connect を使っていないため、全額が運営の Stripe アカウントに入金される。先生への 70% 送金は別途運営が手動で行う**。

## 6. フロー
```
[生徒] 予約確認モーダルで OK
  ↓ bookings INSERT (status='pending_payment')
[生徒] /payment/[bookingId]?ids=... に遷移
  ↓ /api/stripe/create-payment-intent を呼び clientSecret 取得
[生徒] PaymentElement にカード入力 → 支払う
  ↓ Stripe で決済
[Stripe] /payment/success?ids=... にリダイレクト + webhook 配信
  ↓ webhook で bookings.status='paid', paid_at, 分配額を保存、
    availability_slots.status='booked' に更新
[生徒] 成功画面に表示。ステータスをポーリングして「お支払いが完了しました」表示
```

## 7. 返金
Stripe ダッシュボード → 該当 PaymentIntent → Refund。
Webhook `charge.refunded` を受信して `bookings.status='refunded'`、`availability_slots.status='available'` に戻す処理を実装済み。
