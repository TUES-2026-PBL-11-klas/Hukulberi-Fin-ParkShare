export interface UnlockGateRequestDto {
  latitude: number;
  longitude: number;
}

export interface UnlockGateResponseDto {
  success: boolean;
  message: string;
  openedAt?: string;
}
