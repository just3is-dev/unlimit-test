import { IsString, MinLength } from 'class-validator';

/**
 * Request body for POST /pipeline.
 * Validated by NestJS ValidationPipe before reaching the controller.
 */
export class RunPipelineDto {
  @IsString()
  @MinLength(10, { message: 'description must be at least 10 characters' })
  description!: string;
}
