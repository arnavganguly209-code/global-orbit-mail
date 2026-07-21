import { NextResponse } from "next/server";
import type { ApiResponse, ApiErrorBody } from "@/types";

export function ok<T>(data: T, init?: ResponseInit, message?: string) {
  const body: ApiResponse<T> = { success: true, data, message };
  return NextResponse.json(body, { status: 200, ...init });
}

export function created<T>(data: T, message?: string) {
  const body: ApiResponse<T> = { success: true, data, message };
  return NextResponse.json(body, { status: 201 });
}

export function fail(message: string, status = 400, errors?: Record<string, string[]>) {
  const body: ApiErrorBody = { success: false, message, errors };
  return NextResponse.json(body, { status });
}

export async function parseJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
