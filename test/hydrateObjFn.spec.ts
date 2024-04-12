import { assert } from 'chai';
import { Hydratable, hy } from '../src/hydrate';

enum FieldDefinitionTypes {
  BASE = 'BASE',
  MEASUREMENT = 'MEASUREMENT',
}

interface FormatterModel {
  label: string;
  conversionMultiplier: number;
}

class Formatter extends Hydratable<FormatterModel> implements FormatterModel {
  @hy('string') label!: string;
  @hy('number') conversionMultiplier!: number;
}

interface FieldDefinitionModel {
  _id: number;
  name: string;
  type: FieldDefinitionTypes;
}

class FieldDefinition extends Hydratable<FieldDefinitionModel> implements FieldDefinitionModel {
  @hy('number') _id!: number;
  @hy('string') name!: string;
  @hy('string') type!: FieldDefinitionTypes;
}

interface MeasureableFieldDefinitionModel extends FieldDefinitionModel {
  type: FieldDefinitionTypes.MEASUREMENT;
  uom: number;
  formatters: FormatterModel[];
}

class MeasureableFieldDefinition extends FieldDefinition implements MeasureableFieldDefinitionModel {
  @hy('string') type!: FieldDefinitionTypes.MEASUREMENT;
  @hy('number') uom!: number;
  @hy('array', { arrayElementType: Formatter }) formatters!: Formatter[];
}

function FieldDefinitionFactory(model: FieldDefinitionModel): FieldDefinition {
  switch (model.type) {
    case FieldDefinitionTypes.MEASUREMENT:
      return new MeasureableFieldDefinition(model);
    default:
      return new FieldDefinition(model);
  }
}

interface ComponentTypeModel {
  _id: string;
  fields: { [name: string]: FieldDefinitionModel };
}

class ComponentType extends Hydratable<ComponentTypeModel> implements ComponentTypeModel {
  @hy('string') _id!: string;
  @hy('object', { dictionaryValueType: { factory: FieldDefinitionFactory } }) fields!: { [name: string]: FieldDefinition };
}



describe('options.hydrateObjFn', () => {

  it('Should be able to hydrate with a dictionary where the values are made from a factory', () => {
    const model = {
      _id: 'c_1',
      fields: {
        'capacitance': {
          _id: '1',
          name: 'capacitance',
          type: FieldDefinitionTypes.MEASUREMENT,
          uom: '2',
          formatters: [{ label: 'formatter 1', conversionMultiplier: '3' }],
        },
      }
    }
    const c = new ComponentType(model as any);
    assert.isTrue(c instanceof ComponentType);
    assert.exists(c.fields['capacitance']);
    const def = c.fields['capacitance']
    assert.isTrue(def instanceof MeasureableFieldDefinition);
    assertIsOfType(MeasureableFieldDefinition, def);
    assert.equal(def._id, 1)
    assert.equal(def.uom, 2);
    const f = def.formatters[0];
    assert.isTrue(f instanceof Formatter);
    assertIsOfType(Formatter, f);
    assert.equal(f.conversionMultiplier, 3);
  });

  it('Should be able to get diff from two ComponentTypes', () => {
    const model1: any = {
      _id: 'c_1',
      fields: {
        b: {
          type: 'BASE',
          _id: 1,
          name: 'Basic Field Definition',
        },
        c: {
          type: 'MEASUREMENT',
          _id: 2,
          name: 'Measurement Field Definition',
          uom: 2,
          formatters: [{ label: 'F1', conversionMultiplier: 1 }],
        },
      }
    };
    const model2: any = {
      ...model1,
      fields: {
        ...model1.fields,
        c: {
          ...model1.fields.c,
          formatters: [{ label: 'F1', conversionMultiplier: 2 }],
        }
      }
    };

    const diff = new ComponentType(model1).diff(new ComponentType(model2));
    assert.deepEqual(diff, {
      fields: {
        c: {
          formatters: {
            0: {
              conversionMultiplier: [1, 2]
            }
          }
        }
      }
    });
  });
});

type Constructor<T extends {} = {}> = new (...args: any[]) => T;

function assertIsOfType<T extends {} = {}>(cns: Constructor<T>, m: any): asserts m is T {
  if (cns.prototype !== m.constructor.prototype) {
    throw new Error('Message was not of expected type');
  }
}
