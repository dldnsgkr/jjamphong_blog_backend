export interface SuccessResponse<T> {
  /** 응답 성공 여부 */
  success: true;
  /** 응답 코드 */
  code: number;
  /** 응답 메시지 */
  message: string;
  /** 응답 데이터 */
  data?: T;
}

export interface ErrorResponse {
  /** 응답 성공 여부 */
  success: false;
  /** 응답 코드 */
  code: number;
  /** 응답 메시지 */
  message: string;
  /** 오류 object */
  errors?: unknown;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
