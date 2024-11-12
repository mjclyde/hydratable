/* eslint-disable @typescript-eslint/no-explicit-any */
import { Buffer } from 'buffer';

export type HydratableType = 'number' | 'date' | 'bool' | 'string' | 'object' | 'array' | { new(...args: any): any } | { factory: (model: any) => any };

interface ModelMapValue {
  type: HydratableType;
  options: HydrateOptions;
}

const ModelMap = new Map<string, Map<string, ModelMapValue>>();

export type Differences = { [key: string]: [unknown, unknown] | Differences };

export interface HydrateOptions {
  allowNull?: boolean;
  incomingFieldName?: string;
  arrayElementType?: HydratableType;
  dictionaryValueType?: HydratableType;
}

export function hy(type: HydratableType, options: HydrateOptions = {}) {
  return function (target: any, propertyKey: string) {
    let map = ModelMap.get(target.constructor.name);
    if (!map) {
      map = new Map();
      ModelMap.set(target.constructor.name, map);
    }
    map.set(propertyKey, { type, options });
  }
}

export class Hydratable<T> {

  constructor(data: T) {
    this.hydrate(data);
  }

  toJSON(): T {
    const json: Record<string, unknown> = {};

    const getJSON = (thing: any): any => {
      if (thing instanceof Buffer) {
        return thing.toString('base64');
      }
      if (thing instanceof Date) {
        return thing;
      }
      if (thing?.toJSON instanceof Function) {
        return thing.toJSON();
      } else if (thing && Array.isArray(thing)) {
        return thing.map(t => getJSON(t));
      } else if (typeof thing === 'object') {
        const o: Record<string, unknown> = {};
        for (const key in thing) {
          o[key] = getJSON(thing[key])
          if (o[key] === undefined) {
            delete o[key];
          }
        }
        return o;
      }
      return thing;
    };

    this.forEachHyProp((key, value) => {
      json[value.options?.incomingFieldName || key] = getJSON((this as Record<string, unknown>)[key]);
      if (json[value.options?.incomingFieldName || key] === undefined) {
        delete json[value.options?.incomingFieldName || key];
      }
    });

    return json as T;
  }

  diff(other: Hydratable<T>, skip: { [field: string]: true } = {}): Differences {
    const diff: Differences = {};
    this.forEachHyProp((key, propInfo) => {
      if (skip[key]) { return; }
      const field = (this as Record<string, any>)[key];
      const compareField = other ? (other as any)[key] : undefined;
      if (field && propInfo.type === 'array' && compareField) {
        const leftToRight = this.diffArrays(field, compareField);
        const rightToLeft = this.diffArrays(compareField, field, true);
        if (Object.keys(leftToRight).length || Object.keys(rightToLeft).length) {
          diff[key] = { ...rightToLeft, ...leftToRight };
        }
      } else if (field instanceof Hydratable && compareField instanceof Hydratable) {
        const subDiff = field.diff(compareField);
        if (Object.keys(subDiff).length) {
          diff[key] = subDiff;
        }
      } else if (propInfo.type === 'date') {
        if (!this.areDatesEqual(field, compareField)) {
          diff[key] = [field, compareField];
        }
      } else if (propInfo.type === 'object') {
        const leftToRight = this.diffObject(field, compareField);
        const rightToLeft = this.diffObject(compareField, field, true);
        if (Object.keys(leftToRight).length || Object.keys(rightToLeft).length) {
          diff[key] = { ...rightToLeft, ...leftToRight };
        }
      } else if (field !== compareField) {
        diff[key] = [field, compareField];
      }
    });
    return diff;
  }

  private areDatesEqual(a?: Date, b?: Date) {
    if (!a && !b) { return true; }
    else if ((a && !b) || (!a && b)) { return false; }
    const areEqual = a?.getTime() === b?.getTime()
    return areEqual;
  }

  private diffArrays(a?: any[], b?: any[], inverse?: boolean): Differences {
    const diff: Differences = {};
    for (let i = 0; i < (a || []).length; i++) {
      const aEl = a ? a[i] : undefined;
      const bEl = b ? b[i] : undefined;
      if (aEl instanceof Hydratable && bEl instanceof Hydratable) {
        const subDiff = inverse ? bEl.diff(aEl) : aEl.diff(bEl);
        if (Object.keys(subDiff).length) {
          diff[i] = subDiff;
        }
      } else if (this.isArray(aEl) && this.isArray(bEl)) {
        const leftToRight = this.diffArrays(aEl, bEl);
        const rightToLeft = this.diffArrays(bEl, aEl, true);
        if (Object.keys(leftToRight).length || Object.keys(rightToLeft).length) {
          diff[i] = inverse ? { ...leftToRight, ...rightToLeft } : { ...rightToLeft, ...leftToRight };
        }
      } else if (this.isObject(aEl) && this.isObject(bEl)) {
        const leftToRight = this.diffObject(aEl, bEl);
        const rightToLeft = this.diffObject(bEl, aEl, true);
        if (Object.keys(leftToRight).length || Object.keys(rightToLeft).length) {
          diff[i] = inverse ? { ...leftToRight, ...rightToLeft } : { ...rightToLeft, ...leftToRight };
        }
      } else if (aEl !== bEl) {
        const aElJson = aEl instanceof Hydratable ? aEl.toJSON() : aEl;
        const bElJson = bEl instanceof Hydratable ? bEl.toJSON() : bEl;
        diff[i] = inverse ? [bElJson, aElJson] : [aElJson, bElJson];
      }
    }

    return diff;
  }

  private diffObject(a?: Record<string, unknown>, b?: Record<string, unknown>, inverse?: boolean) {
    const diff: Differences = {};
    for (const key in a) {
      const field = a[key];
      const compareField = b?.[key];
      if (field instanceof Hydratable && compareField instanceof Hydratable) {
        const subDiff = inverse ? compareField.diff(field) : field.diff(compareField);
        if (Object.keys(subDiff).length) {
          diff[key] = subDiff;
        }
      } if (this.isObject(field) && this.isObject(compareField)) {
        const leftToRight = this.diffObject(field, compareField);
        const rightToLeft = this.diffObject(compareField, field, true);
        if (Object.keys(leftToRight).length || Object.keys(rightToLeft).length) {
          diff[key] = inverse ? { ...leftToRight, ...rightToLeft } : { ...rightToLeft, ...leftToRight };
        }
      } else if (this.isArray(field) && this.isArray(compareField)) {
        const leftToRight = this.diffArrays(field, compareField);
        const rightToLeft = this.diffArrays(compareField, field, true);
        if (Object.keys(leftToRight).length || Object.keys(rightToLeft).length) {
          diff[key] = inverse ? { ...leftToRight, ...rightToLeft } : { ...rightToLeft, ...leftToRight };
        }
      } else if (field !== compareField) {
        const fieldJson = field instanceof Hydratable ? field.toJSON() : field;
        const compareFieldJson = compareField instanceof Hydratable ? compareField.toJSON() : compareField;
        diff[key] = inverse ? [compareFieldJson, fieldJson] : [fieldJson, compareFieldJson];
      }
    }

    return diff;
  }

  private hydrate(data?: any) {
    if (!data || !Object.keys(data).length) { return; }
    this.forEachHyProp((key, value) => {
      const incomingKey = value.options.incomingFieldName || key;
      if (data[incomingKey] === undefined) { return; }
      this.setField(data, key, value.type, value.options);
    });
  }

  private setField(data: any, key: string, type: HydratableType, options: HydrateOptions) {
    const incomingKey = options.incomingFieldName || key;
    switch (type) {
      case 'number':
        return this.setNumber(key, data[incomingKey], options);
      case 'date':
        return this.setDate(key, data[incomingKey], options);
      case 'bool':
        return this.setBool(key, data[incomingKey], options);
      case 'string':
        return this.setString(key, data[incomingKey], options);
      case 'object':
        return this.setObject(key, data[incomingKey], options);
      case 'array':
        return this.setArray(key, data[incomingKey], options);
    }

    if (type instanceof Function && data[incomingKey] !== undefined) {
      if (type === Buffer) {
        const copy = this.copyBuffer(data[incomingKey], options);
        if (copy !== undefined) {
          this.setOnThis(key, copy);
        }
      } else {
        this.setOnThis(key, new type(data[incomingKey]))
      }
    } else if (type && 'factory' in type && type.factory instanceof Function && data[incomingKey] !== undefined) {
      this.setOnThis(key, type.factory(data[incomingKey]));
    }
  }

  private setNumber(key: string, value: any, options: HydrateOptions) {
    if (typeof value === 'string') {
      value = +value;
    }
    if (value === null && !options.allowNull) {
      value = undefined;
    }
    if (!isNaN(value)) {
      this.setOnThis(key, value);
    }
  }

  private setDate(key: string, value: any, options: HydrateOptions) {
    if (value === null && options.allowNull) {
      this.setOnThis(key, value);
      return;
    }
    if (!value || (!(value instanceof Date) && !['string', 'number'].includes(typeof value))) {
      return;
    }
    value = new Date(value);
    if (!isNaN(value.getTime())) {
      this.setOnThis(key, new Date(value));
    }
  }

  private setBool(key: string, value: any, options: HydrateOptions) {
    if (typeof value === 'boolean') {
      this.setOnThis(key, value);
      return;
    }
    if (typeof value === 'string') {
      value = value.toLowerCase();
      if (value === 'true') {
        this.setOnThis(key, true);
      } else if (value === 'false') {
        this.setOnThis(key, false);
      }
      return;
    }
    if (value === null && options.allowNull) {
      this.setOnThis(key, null);
    }
  }

  private setString(key: string, value: any, options: HydrateOptions) {
    if (!options.allowNull && value === null) { return; }
    this.setOnThis(key, value);
  }

  private setArray(key: string, value: any, options: HydrateOptions) {
    if (!options.allowNull && value === null) { return; }
    const type = options.arrayElementType;
    if (type && type instanceof Function) {
      this.setOnThis(key, this.copyArray(value).map(el => new type(el)));
    } else if (typeof type === 'object' && 'factory' in type && type.factory instanceof Function) {
      this.setOnThis(key, this.copyArray(value).map(el => type.factory(el)));
    } else {
      this.setOnThis(key, this.copyArray(value))
    }
  }

  private setObject(key: string, value: any, options: HydrateOptions) {
    if (!options.allowNull && value === null) { return; }
    const type = options.dictionaryValueType;
    if (type && type instanceof Function) {
      Object.keys(value).forEach(k => {
        value[k] = new type(value[k]);
      });
    } else if (typeof type === 'object' && 'factory' in type && type.factory instanceof Function) {
      Object.keys(value).forEach(k => {
        value[k] = type.factory(value[k]);
      });
    }
    this.setOnThis(key, this.copyObject(value));
  }

  private copyBuffer(value: unknown, options: HydrateOptions) {
    if (!options.allowNull && value === null) { return; }
    if (typeof value === 'string') {
      return Buffer.from(value, 'base64');
    } else if (Array.isArray(value) || value instanceof Buffer) {
      return Buffer.from(value);
    }
  }

  private copyArray(value: unknown) {
    const copy: Array<unknown> = [];
    if (Array.isArray(value)) {
      for (const el of value) {
        if (this.isDate(el)) {
          copy.push(new Date(el as Date));
        } else {
          copy.push(this.isObject(el) ? this.copyObject(el) : this.isArray(el) ? this.copyArray(el) : el)
        }
      }
    }
    return copy;
  }

  private copyObject(obj: object) {
    const keys = Object.keys(obj);
    const copy: Record<string, unknown> = {};
    for (const key of keys) {
      const value = (obj as Record<string, unknown>)[key];
      if (this.isDate(value)) {
        copy[key] = new Date(value as Date | string);
      } else {
        copy[key] = (this.isObject(value) && !(value instanceof Hydratable)) ? this.copyObject(value) : value;
      }
    }
    return copy;
  }

  private forEachHyProp(cb: (key: string, value: ModelMapValue) => void) {
    const handledFields: { [fieldName: string]: ModelMapValue } = {};
    let name = '';
    let proto = (this as Record<string, unknown>)['__proto__'];
    do {
      name = proto?.constructor?.name || '';
      const map = ModelMap.get(name);
      if (map) {
        map.forEach((value, key) => {
          if (handledFields[key]) { return; }
          handledFields[key] = value;
          cb(key, value);
        });
      }
      proto = (proto as Record<string, unknown>)?.['__proto__'];
    } while (name);
  }

  private isObject(thing: unknown): thing is Record<string, unknown> {
    return typeof thing === 'object' && thing !== null && !Array.isArray(thing);
  }

  private isArray(thing: unknown): thing is Array<unknown> {
    return !!thing && Array.isArray(thing);
  }

  private isDate(value: unknown): value is Date | string {
    return value instanceof Date ||
      (
        typeof value === 'string' &&
        /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/.test(value as string)
      );
  }

  private setOnThis(key: string, val: unknown) {
    (this as Record<string, unknown>)[key] = val;
  }
}
