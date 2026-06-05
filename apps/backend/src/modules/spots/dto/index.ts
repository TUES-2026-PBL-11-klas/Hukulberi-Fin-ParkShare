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
  ArrayMinSize,
  ArrayMaxSize,
  IsIn,
  IsInt,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SpotVerificationStatus } from '@prisma/client';

const UPDATE_SPOT_VERIFICATION_STATUSES = [
  'VERIFIED',
  'REJECTED',
] as const satisfies readonly SpotVerificationStatus[];
const availabilityDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

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

  @IsInt()
  @Min(1)
  @Max(200)
  spaceCount: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(availabilityDays, { each: true })
  availableDays: string[];

  @Matches(timePattern)
  availableFrom: string;

  @Matches(timePattern)
  availableUntil: string;

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
  @IsInt()
  @Min(1)
  @Max(200)
  spaceCount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsIn(availabilityDays, { each: true })
  availableDays?: string[];

  @IsOptional()
  @Matches(timePattern)
  availableFrom?: string;

  @IsOptional()
  @Matches(timePattern)
  availableUntil?: string;

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
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
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

export class UpdateSpotActiveDto {
  @IsBoolean()
  isActive: boolean;
}
