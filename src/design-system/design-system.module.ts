import { Module } from '@nestjs/common';

import { DesignSystemService } from './design-system.service';

@Module({
  providers: [DesignSystemService],
  exports: [DesignSystemService],
})
export class DesignSystemModule {}
