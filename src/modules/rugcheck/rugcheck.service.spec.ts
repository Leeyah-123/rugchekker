import { Test, TestingModule } from '@nestjs/testing';
import { RugcheckService } from './rugcheck.service';

describe('RugcheckService', () => {
  let service: RugcheckService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RugcheckService],
    }).compile();

    service = module.get<RugcheckService>(RugcheckService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
