import { Test, TestingModule } from '@nestjs/testing';
import { BasePlatformController } from './base.controller';

describe('BaseController', () => {
  let controller: BasePlatformController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BasePlatformController],
    }).compile();

    controller = module.get<BasePlatformController>(BasePlatformController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
