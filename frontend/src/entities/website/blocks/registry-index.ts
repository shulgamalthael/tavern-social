/**
 * Единственная точка, которая должна быть заимпортирована ХОТЯ БЫ раз до
 * первого обращения к реестру (`getBlockDefinition`/`listBlockDefinitions`)
 * — каждый файл категории регистрирует себя через побочный эффект
 * (`registerBlock(...)` на верхнем уровне модуля, см. любой `index.tsx`
 * внутри папки категории блоков). И builder (`widgets/website-builder`), и
 * renderer (`entities/website/ui/WebsiteRenderer`, через любую страницу —
 * canvas, Preview, публичный `/business/[id]`) импортируют именно этот
 * файл, а не отдельные категории по одной — так добавление нового типа
 * блока в будущем требует одной новой папки в `blocks/` и одной строки
 * здесь, а не правки самого builder-а или renderer-а.
 */
import './layout';
import './typography';
import './media';
import './actions';
import './business';
import './navigation';
import './content';
import './commerce';
import './booking';
import './blog';
import './forms';
import './utility';
import './web3';
import './advertising';
