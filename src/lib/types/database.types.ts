export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'teacher' | 'student'
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role: 'teacher' | 'student'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'teacher' | 'student'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      student_profiles: {
        Row: {
          id: string
          user_id: string
          bio: string | null
          learning_goals: string | null
          desired_teacher_type: string | null
          japanese_level: 'beginner' | 'intermediate' | 'advanced' | null
          availability: string | null
          location: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bio?: string | null
          learning_goals?: string | null
          desired_teacher_type?: string | null
          japanese_level?: 'beginner' | 'intermediate' | 'advanced' | null
          availability?: string | null
          location?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bio?: string | null
          learning_goals?: string | null
          desired_teacher_type?: string | null
          japanese_level?: 'beginner' | 'intermediate' | 'advanced' | null
          availability?: string | null
          location?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      teacher_profiles: {
        Row: {
          id: string
          user_id: string
          bio: string | null
          teaching_experience: string | null
          specialties: string[] | null
          location: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bio?: string | null
          teaching_experience?: string | null
          specialties?: string[] | null
          location?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bio?: string | null
          teaching_experience?: string | null
          specialties?: string[] | null
          location?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          teacher_id: string
          student_id: string
          status: 'active' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          student_id: string
          status?: 'active' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          student_id?: string
          status?: 'active' | 'archived'
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          match_id: string
          sender_id: string
          content: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          sender_id: string
          content: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          sender_id?: string
          content?: string
          is_read?: boolean
          created_at?: string
        }
      }
    }
  }
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type StudentProfile = Database['public']['Tables']['student_profiles']['Row']
export type TeacherProfile = Database['public']['Tables']['teacher_profiles']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type Message = Database['public']['Tables']['messages']['Row']

// Combined types for UI
export type StudentWithProfile = Profile & {
  student_profile: StudentProfile | null
}

export type TeacherWithProfile = Profile & {
  teacher_profile: TeacherProfile | null
}

export type MatchWithProfiles = Match & {
  teacher: Profile
  student: Profile & {
    student_profile: StudentProfile | null
  }
}

export type MessageWithSender = Message & {
  sender: Profile
}
