import { NextResponse } from "next/server"

export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_JSON: "INVALID_JSON",
  MISSING_MESSAGES: "MISSING_MESSAGES",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  DOCUMENT_NOT_FOUND: "DOCUMENT_NOT_FOUND",
  DOCUMENT_FORBIDDEN: "DOCUMENT_FORBIDDEN",
  MISSING_SILICONFLOW_API_KEY: "MISSING_SILICONFLOW_API_KEY",
  ROBOT_API_ERROR: "ROBOT_API_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

export function createErrorResponse(params: {
  status: number
  error: string
  errorCode: ErrorCode
  errorId?: string
}) {
  const { status, error, errorCode, errorId } = params

  return NextResponse.json(
    {
      error,
      errorCode,
      errorId:
        process.env.NODE_ENV === "development" ? errorId : undefined,
    },
    { status },
  )
}

