interface AvatarProps {
  url?: string | null
  name?: string | null
  fallback?: string
  className: string
  imgClassName?: string
}

export default function Avatar({
  url,
  name,
  fallback = 'U',
  className,
  imgClassName,
}: AvatarProps) {
  if (url) {
    return (
      <div className={`${className} overflow-hidden`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name || 'avatar'}
          className={`w-full h-full object-cover ${imgClassName || ''}`}
        />
      </div>
    )
  }
  return <div className={className}>{name?.charAt(0) || fallback}</div>
}
