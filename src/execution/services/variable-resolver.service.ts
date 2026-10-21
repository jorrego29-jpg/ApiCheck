// src/execution/services/variable-resolver.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class VariableResolverService {
  /**
   * Reemplaza patrones {{key}} con sus valores según el diccionario de variables activas.
   */
  resolveVariables(target: string, variables: Record<string, string>): string {
    if (!target) return target;

    return target.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  /**
   * Interpola variables sobre objetos complejos (Headers, Body JSON, etc.)
   */
  resolveObject<T>(obj: T, variables: Record<string, string>): T {
    if (!obj) return obj;
    const jsonString = JSON.stringify(obj);
    const resolvedString = this.resolveVariables(jsonString, variables);
    return JSON.parse(resolvedString);
  }
}