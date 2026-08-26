import { IsArray, IsObject } from 'class-validator';

/**
 * Намеренно неглубокая валидация — только верхнеуровневая форма
 * `WebsiteDocument` (страницы/тема/настройки — все три обязательны и должны
 * быть правильного «шапка»-типа), без спуска в форму `props` конкретных
 * блоков. Билдер должен уметь сохранить документ с новым типом блока или
 * новым полем `props`, не дожидаясь правки этого DTO на backend — иначе
 * добавление компонента в реестр (frontend) требовало бы ещё и правки
 * backend-валидации, что прямо противоречит цели «добавление компонента
 * должно быть максимально простым» (см. корневой план фичи).
 */
export class UpdateWebsiteDocumentDto {
  @IsArray({ message: 'pages должен быть массивом' })
  pages!: unknown[];

  @IsObject({ message: 'theme должен быть объектом' })
  theme!: Record<string, unknown>;

  @IsObject({ message: 'settings должен быть объектом' })
  settings!: Record<string, unknown>;
}
