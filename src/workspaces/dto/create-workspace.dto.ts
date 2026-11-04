// src/workspaces/dto/create-workspace.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
