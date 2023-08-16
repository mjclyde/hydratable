/* eslint-disable @typescript-eslint/no-explicit-any */
import { Buffer } from 'buffer';

export type HydratableType = 'number' | 'date' | 'bool' | 'string' | 'object' | { new(...args: any): any };

interface ModelMapValue {
  type: HydratableType;
  options: HydrateOptions;
}

const ModelMap = new Map<string, Map<string, ModelMapValue>>();

export interface HydrateOptions {
  allowNull?: boolean;
  incomingFieldName?: string;
  array?: boolean;
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
    }

    if (type instanceof Function && data[incomingKey] !== undefined) {
      if (type === Buffer) {
        const copy = this.copyBuffer(data[incomingKey], options);
        if (copy !== undefined) {
          this.setOnThis(key, copy);
        }
      } else {
        if (options.array) {
          this.setOnThis(key, data[incomingKey].map((d: unknown) => new type(d)));
        } else {
          this.setOnThis(key, new type(data[incomingKey]))
        }
      }
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

  private setObject(key: string, value: any, options: HydrateOptions) {
    if (!options.allowNull && value === null) { return; }
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

  private copyObject(obj: object) {
    const keys = Object.keys(obj);
    const copy: Record<string, unknown> = {};
    for (const key of keys) {
      const value = (obj as Record<string, unknown>)[key];
      if (this.isDate(value)) {
        copy[key] = new Date(value as Date | string);
      } else {
        copy[key] = this.isObject(value) ? this.copyObject(value) : value;
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
