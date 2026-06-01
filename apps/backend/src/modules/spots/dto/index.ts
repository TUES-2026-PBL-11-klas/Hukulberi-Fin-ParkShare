/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  IsString,
  IsNumber,
  IsOptional,
  IsLatitude,
  IsLongitude,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

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
