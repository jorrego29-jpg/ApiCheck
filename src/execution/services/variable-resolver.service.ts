// src/execution/services/variable-resolver.service.ts
import { Injectable } from '@nestjs/common';

const VARIABLE = /\{\{\s*([\w.-]+)\s*\}\}/g;

@Injectable()
export class VariableResolverService {
  /**
   * Reemplaza patrones {{key}} con sus valores según el diccionario de variables activas.
   * Las variables sin valor se dejan tal cual.
   */
  resolveVariables(target: string, variables: Record<string, string>): string {
    if (!target) return target;
    return this.replace(target, variables, (value) => value);
  }

  /**
   * Interpola variables sobre objetos complejos (Headers, Body JSON, etc.)
   *
   * La sustitución se hace sobre el JSON ya serializado, así que cada valor se escapa antes de
   * entrar: un token con comillas, una contraseña con `\` o un valor con saltos de línea no
   * pueden romper el JSON ni colar otras claves.
   */
  resolveObject<T>(obj: T, variables: Record<string, string>): T {
    if (!obj) return obj;
    const jsonString = JSON.stringify(obj);
    const resolvedString = this.replace(jsonString, variables, (value) =>
      JSON.stringify(value).slice(1, -1),
    );
    return JSON.parse(resolvedString) as T;
  }

  private replace(
    target: string,
    variables: Record<string, string>,
    format: (value: string) => string,
  ): string {
    return target.replace(VARIABLE, (match, key: string) =>
      Object.hasOwn(variables, key) ? format(String(variables[key])) : match,
    );
  }
}
