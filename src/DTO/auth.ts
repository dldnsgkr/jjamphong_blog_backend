import { z } from "zod";

/**
 * 일반 로그인 스키마
 */
export const LoginSchema = z.object({
  provider_id: z.string().trim().min(1, { message: "아이디를 입력해주세요." }),
  password: z.string().trim().min(1, { message: "비밀번호를 입력해주세요." }),
});

// DTO 타입 자동 생성
export type LoginRequestDto = z.infer<typeof LoginSchema>;

/**
 * 일반 회원가입 스키마
 */
export const SignupSchema = LoginSchema.extend({
  email: z.string().email({ message: "유효한 이메일 주소를 입력해주세요." }),
  confirmPassword: z
    .string()
    .trim()
    .min(1, { message: "비밀번호 확인을 입력해주세요." }),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "비밀번호가 일치하지 않습니다.",
});

// DTO 타입 자동 생성
export type SignupRequestDto = z.infer<typeof SignupSchema>;

/**
 * 회원 정보 수정 스키마
 */
export const UpdateProfileSchema = z.object({
  provider_id: z
    .string()
    .trim()
    .min(1, { message: "아이디를 입력해주세요." })
    .optional(),
  password: z
    .string()
    .trim()
    .min(1, { message: "비밀번호를 입력해주세요." })
    .optional(),
  nickname: z
    .string()
    .trim()
    .min(1, { message: "닉네임을 입력해주세요." })
    .optional(),
  userExplain: z.string().optional(),
  blog_title: z.string().optional(),
  social_instagram: z.string().optional(),
  social_slack: z.string().optional(),
  social_discord: z.string().optional(),
  social_github: z.string().optional(),
  social_phone: z.string().optional(),
  social_facebook: z.string().optional(),
  email: z.string().optional(),
});

// DTO 타입 자동 생성
export type UpdateProfileRequestDto = z.infer<typeof UpdateProfileSchema>;
