/* eslint-disable @typescript-eslint/no-explicit-any */
import { assert } from 'chai';
import { Hydratable, hy } from '../src/hydrate';
describe('Hydrate', () => {

  describe('Number', () => {

    interface PersonModel {
      age?: number;
    }

    interface PlaceModel {
      stars: number | null
    }

    class Person extends Hydratable<void | PersonModel> implements PersonModel {
      @hy('number') age?: number;
    }

    class Place extends Hydratable<PlaceModel> implements PlaceModel {
      @hy('number', { allowNull: true }) stars!: number | null;
    }

    it('should be able to create new person with no age', () => {
      const p = new Person();
      assert.isUndefined(p.age);
    });

    it('should handle NaN', () => {
      const p = new Person({ age: 'wat?' } as any);
      assert.isUndefined(p.age);
    });

    it('should handle number of type number', () => {
      const p = new Person({ age: 30 });
      assert.equal(p.age, 30);
    });

    it('should handle a number that is not allowed to be null', () => {
      const p = new Person({ age: null } as any);
      assert.isUndefined(p.age);
    });

    it('should handle a number that is allowed to be null', () => {
      const p = new Place({ stars: null });
      assert.isNull(p.stars);
    });

    it('should handle a number passed in as a string', () => {
      const p = new Person({ age: '123' } as any);
      assert.equal(p.age, 123);
    });

  });

  describe('Date', () => {

    interface BirthdayPersonModel {
      birthday: Date;
    }

    interface MeetingModel {
      date?: Date | null;
    }

    class BirthdayBoy extends Hydratable<BirthdayPersonModel> implements BirthdayPersonModel {
      @hy('date') birthday!: Date;
    }

    class Meeting extends Hydratable<MeetingModel> implements MeetingModel {
      @hy('date', { allowNull: true }) date?: Date | null;
    }

    it('should handle a date as a date object', () => {
      const b = new BirthdayBoy({ birthday: new Date('1950-02-01') });
      assert.isTrue(b.birthday instanceof Date);
    });

    it('should handle a date being passed in as a valid string', () => {
      const b = new BirthdayBoy({ birthday: '2013-03-22' } as any);
      assert.isTrue(b.birthday instanceof Date);
      const birthday = new Date('2013-03-22');
      assert.equal(b.birthday.getFullYear(), birthday.getFullYear());
      assert.equal(b.birthday.getMonth(), birthday.getMonth());
      assert.equal(b.birthday.getDate(), birthday.getDate());
    });

    it('should handle a null date when null is not allowed', () => {
      const b = new BirthdayBoy({ birthday: null } as any);
      assert.isUndefined(b.birthday);
    });

    it('should handle a date that is allowed to be null', () => {
      const m = new Meeting({ date: null });
      assert.isNull(m.date);
    });

    it('should handle a number being passed in for the date', () => {
      const m = new Meeting({ date: Date.now() } as any);
      assert.isTrue(m.date instanceof Date);
      assert.approximately(m.date?.getTime() || 0, new Date().getTime(), 1000);
    });

    it('should ignore an invalid date (string passed in)', () => {
      const m = new Meeting({ date: 'hey' } as any);
      assert.isUndefined(m.date);
    });

    it('should ignore an invalid date (bool passed in)', () => {
      const m = new Meeting({ date: true } as any);
      assert.isUndefined(m.date);
    });
  });

  describe('Boolean', () => {

    interface ShapeModel {
      isMovable?: boolean;
    }

    interface InteractiveShapeModel extends ShapeModel {
      isMovable: boolean;
    }

    class Shape<T extends ShapeModel> extends Hydratable<void | T> implements ShapeModel {
      @hy('bool', { allowNull: true })
      isMovable?: boolean;
    }

    class InteractiveShape extends Shape<InteractiveShapeModel> implements InteractiveShapeModel {
      @hy('bool') isMovable!: boolean;

      constructor(data: InteractiveShapeModel) {
        super(data);
      }
    }

    it('should handle null when allowed and not allowed', () => {
      const s = new Shape({ isMovable: null } as any);
      assert.isNull(s.isMovable);

      const i = new InteractiveShape({ isMovable: null } as any);
      assert.isUndefined(i.isMovable);
    });

    it('should handle a true or false value', () => {
      const s = new Shape({ isMovable: true });
      assert.isTrue(s.isMovable);

      const i = new InteractiveShape({ isMovable: false });
      assert.isFalse(i.isMovable);
    });

    it('should handle a string value of true or false', () => {
      const s = new Shape({ isMovable: 'true' } as any);
      assert.isTrue(s.isMovable);

      const i = new InteractiveShape({ isMovable: 'false' } as any);
      assert.isFalse(i.isMovable);
    });

    it('should handle an invalid bool', () => {
      const s = new Shape({ isMovable: 'testing' } as any);
      assert.isUndefined(s.isMovable);

      const i = new InteractiveShape({ isMovable: 10 } as any);
      assert.isUndefined(i.isMovable);
    });

  });

  describe('Inheritance', () => {

    interface ThingModel {
      foo: string;
    }

    class Thing extends Hydratable<ThingModel> implements ThingModel {
      @hy('string') foo!: string;
    }

    interface ParentModel {
      things: ThingModel[];
    }

    class Parent extends Hydratable<ParentModel> implements ParentModel {
      @hy('array', { arrayElementType: Thing }) things!: Thing[];
    }

    it('should be able to hydrate class with sub class list inside ', () => {
      const p = new Parent({ things: [{ foo: 'bar' }] });
      assert.equal(p.things[0].foo, 'bar');
      assert.isTrue(p instanceof Parent);
      assert.isTrue(p.things[0] instanceof Thing);
      const json = p.toJSON();
      json.things[0].foo = 'baz';
      assert.notEqual(p.things[0].foo, json.things[0].foo);
    });
  });

  describe('JSON', () => {

    interface FunModel {
      date: Date;
      optionalDate?: Date;
      number: number;
      string: string;
      bool: boolean;
      object: { date: Date; number: number };
    }

    class FunThing extends Hydratable<FunModel> implements FunModel {
      @hy('date') date!: Date;
      @hy('date') optionalDate?: Date;
      @hy('number') number!: number;
      @hy('string') string!: string;
      @hy('bool') bool!: boolean;
      @hy('object') object!: { date: Date; number: number };
    }

    it('should be able to create an object and turn it to json', () => {
      const a = new FunThing({
        date: new Date(),
        number: 1,
        string: 'hai there',
        bool: true,
        object: { date: new Date(Date.now() - 10 * 60 * 1000), number: 10 },
      });
      assert.isTrue(a instanceof FunThing);
      const json = a.toJSON();
      assert.isFalse(json instanceof FunThing);
      assert.isTrue(json.date instanceof Date);
      assert.equal(a.date.getTime(), new Date(json.date).getTime());
      assert.equal(a.number, json.number);
      assert.equal(a.string, json.string);
      assert.equal(a.bool, json.bool);
      assert.equal(Object.keys(a.object).length, Object.keys(json.object).length);
      assert.isTrue(json.object.date instanceof Date);
      assert.equal(a.object.date.getTime(), new Date(json.object.date).getTime());
      assert.equal(a.object.number, json.object.number);
      json.object.number = 11;
      assert.notEqual(a.object.number, json.object.number);
    });

  });

  describe('Different Incoming Field', () => {

    interface SomeUserModel {
      user_id: string;
      family_name: string;
      given_name: string;
    }

    class SomeUSer extends Hydratable<SomeUserModel> {
      @hy('string', { incomingFieldName: 'user_id' }) _id!: string;
      @hy('string', { incomingFieldName: 'family_name' }) lastName!: string;
      @hy('string', { incomingFieldName: 'given_name' }) firstName!: string;
    }

    it('Should be able to hydrate SomeUser from model', () => {
      const model: SomeUserModel = {
        user_id: 'abc',
        family_name: 'Scott',
        given_name: 'Micheal',
      };
      const u = new SomeUSer(model);
      assert.equal(u._id, model.user_id);
      assert.equal(u.firstName, model.given_name);
      assert.equal(u.lastName, model.family_name);
      const json = u.toJSON();
      assert.equal(json.user_id, u._id);
      assert.equal(json.family_name, u.lastName);
      assert.equal(json.given_name, u.firstName);
    });

  });

  describe('Object With Buffer', () => {

    interface FileModel {
      data: Buffer;
    }

    class File extends Hydratable<FileModel> implements File {
      @hy(Buffer) data!: Buffer;
    }

    it('Should be able to hydrate a file with data as an array of numbers', () => {
      const file = new File({ data: [1, 2, 3, 4, 5] as any });
      assert.isTrue(file.data instanceof Buffer);
    });
  });

  describe('Diff', () => {
    interface DeviceModel {
      id: number;
      coords: number[];
    }

    class Device extends Hydratable<DeviceModel> implements DeviceModel {
      @hy('number') id!: number;
      @hy('array', { arrayElementType: 'number' }) coords!: number[];
    }
    interface MeterModel {
      utilityTypeId: number;
      imr: number;
      multiplier: number;
      device: DeviceModel;
      updatedAt?: Date;
    }

    class Meter extends Hydratable<MeterModel> implements MeterModel {
      @hy('number') utilityTypeId!: number;
      @hy('number') imr!: number;
      @hy('number') multiplier!: number;
      @hy(Device) device!: Device;
      @hy('date') updatedAt?: Date;
    }
    interface UnitModel {
      name: string;
      createdAt: Date;
      meters: MeterModel[];
    }

    class Unit extends Hydratable<UnitModel> implements UnitModel {
      @hy('string') name!: string;
      @hy('date') createdAt!: Date;
      @hy('array', { arrayElementType: Meter }) meters!: MeterModel[];
    }

    it('Should diff properly when adding fields of objects within array field', () => {
      const before: UnitModel = {
        name: 'U1',
        createdAt: new Date(),
        meters: [
          {
            utilityTypeId: 1,
            imr: 100,
            multiplier: 1,
            device: { id: 0xBB000001, coords: [123, 234] },
          },
          {
            utilityTypeId: 2,
            imr: 200,
            multiplier: 10,
            device: { id: 0xBB000002, coords: [123, 234] },
          },
        ],
      };
      const after: UnitModel = {
        ...before,
      };
      after.meters = [
        { ...before.meters[0] },
        { ...before.meters[1], updatedAt: new Date(Date.UTC(2023, 10, 16)) },
      ];
      const diff = new Unit(before).diff(new Unit(after));
      assert.deepEqual(diff, {
        'meters': {
          '1': {
            'updatedAt': [undefined, new Date(Date.UTC(2023, 10, 16))],
          }
        }
      });
    });

    it('Should diff properly when changing fields of objects within array field', () => {
      const before: UnitModel = {
        name: 'U1',
        createdAt: new Date(),
        meters: [
          {
            utilityTypeId: 1,
            imr: 100,
            multiplier: 1,
            device: { id: 0xBB000001, coords: [123, 234] },
          },
          {
            utilityTypeId: 2,
            imr: 200,
            multiplier: 10,
            device: { id: 0xBB000002, coords: [123, 234] },
          },
        ],
      };
      const after: UnitModel = {
        ...before,
      };
      after.meters = [
        { ...before.meters[0] },
        { ...before.meters[1], device: { id: 0xBB000002, coords: [123, 123] } },
      ];
      const diff = new Unit(before).diff(new Unit(after));
      assert.deepEqual(diff, {
        meters: {
          '1': {
            'device': {
              'coords': {
                '1': [234, 123]
              }
            }
          },
        },
      });
    });

    it('Should diff properly when adding new element to array field', () => {
      const before: UnitModel = {
        name: 'U1',
        createdAt: new Date(),
        meters: [
          {
            utilityTypeId: 1,
            imr: 100,
            multiplier: 1,
            device: { id: 0xBB000001, coords: [123, 234] },
          },
          {
            utilityTypeId: 2,
            imr: 200,
            multiplier: 10,
            device: { id: 0xBB000002, coords: [123, 234] },
          },
        ],
      };
      const after: UnitModel = {
        ...before,
        meters: [
          ...before.meters,
          {
            utilityTypeId: 3,
            imr: 50,
            multiplier: 1,
            device: { id: 0xBB000003, coords: [123, 234] },
          }
        ]
      };
      const diff = new Unit(before).diff(new Unit(after));
      assert.deepEqual(diff, {
        meters: {
          '2': [undefined, { ...after.meters[2] }],
        },
      });
    });



  });

});
