import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { RunPipelineDto } from './pipeline.dto';
import { FinalOutput } from './pipeline.schemas';
import { PipelineService } from './pipeline.service';

/**
 * PipelineController — HTTP facade over PipelineService.
 *
 * Single endpoint:
 *   POST /pipeline  { "description": "..." }  →  FinalOutput JSON
 *
 * Validation is handled by NestJS ValidationPipe (registered in main.ts).
 * All business logic lives in PipelineService — this controller is intentionally thin.
 */
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async run(@Body() dto: RunPipelineDto): Promise<FinalOutput> {
    return this.pipeline.run(dto.description);
  }
}
