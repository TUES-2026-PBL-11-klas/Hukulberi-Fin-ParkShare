import {
  IsString,
  IsNumber,
  IsOptional,
  IsLatitude,
  IsLongitude,
  Min,
  Max,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  IsIn,
  MaxLength,
} from 'class-validator';
import { SpotVerificationStatus } from '@prisma/client';

const UPDATE_SPOT_VERIFICATION_STATUSES = [
  'VERIFIED',
  'REJECTED',
] as const satisfies readonly SpotVerificationStatus[];

export class CreateSpotDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  address: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  @IsNumber()
  @Min(0)
  pricePerHour: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(1500000, { each: true })
  photoUrls?: string[];
}

export class UpdateSpotDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerHour?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(1500000, { each: true })
  photoUrls?: string[];
}

export class SearchSpotsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  radiusKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class UpdateSpotVerificationDto {
  @IsIn(UPDATE_SPOT_VERIFICATION_STATUSES)
  status: (typeof UPDATE_SPOT_VERIFICATION_STATUSES)[number];

  @IsOptional()
  @IsString()
  note?: string;
}
