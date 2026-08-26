import { IsString } from 'class-validator';

export class ForwardMessageDto {
  /** `@IsString()`, не `@IsUUID()` — тот же выбор, что и у `groupId` в
   * `CreatePostDto`: id треда не гарантированно UUID-формата во всех
   * сценариях, жёсткая проверка формата здесь лишняя (существование треда
   * и участие в нём всё равно проверяет `ThreadsService.forwardMessage`). */
  @IsString()
  targetThreadId!: string;
}
