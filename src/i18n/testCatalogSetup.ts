/**
 * Arranque de Vitest: deja el catálogo inglés registrado antes de la primera
 * prueba.
 *
 * En producción el inglés llega por importación dinámica y `translate()`
 * responde en español hasta que aterriza. Una prueba de componente no puede
 * esperar a esa promesa sin volverse asíncrona, así que el entorno de pruebas
 * lo registra de una vez y las 21 pruebas que rinden en inglés siguen
 * afirmando sobre inglés, sin tocar ni una.
 *
 * Lo que este archivo esconde —el instante en que el catálogo aún no está— se
 * prueba aparte y a propósito en `catalogs.test.ts`, con el registro limpio.
 */
import { registerCatalog } from './catalogs';
import { en } from './catalogEn';

registerCatalog('en', en);
