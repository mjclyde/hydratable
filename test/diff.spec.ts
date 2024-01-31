import { assert } from "chai";
import { Hydratable, hy } from "../src/hydrate";

describe('diff', () => {
  describe('Should be able to diff a complex Billing Configuration', () => {
    interface CardModel {
      id: string;
      last4?: string;
    }

    class Card extends Hydratable<CardModel> implements CardModel {
      @hy('string') id!: string;
      @hy('string') last4?: string;
    }

    interface PaymentInfoModel {
      cards: CardModel[];
      customerId?: string;
    }

    class PaymentInfo extends Hydratable<PaymentInfoModel> implements PaymentInfoModel {
      @hy('array', { arrayElementType: Card }) cards!: Card[];
      @hy('string') customerId?: string;
    }

    interface BillingSettingsModel {
      permissions: string[];
      directBill: boolean;
      waived?: boolean;
    }

    class BillingSettings extends Hydratable<BillingSettingsModel> implements BillingSettingsModel {
      @hy('array', { arrayElementType: 'string' }) permissions!: string[];
      @hy('bool') directBill!: boolean;
      @hy('bool') waived?: boolean;
    }

    interface BillingConfigurationModel {
      settings: { [key: string]: BillingSettingsModel };
      paymentInfo: PaymentInfoModel;
    }

    class BillingConfiguration extends Hydratable<BillingConfigurationModel> implements BillingConfigurationModel {
      @hy('object', { dictionaryValueType: BillingSettings }) settings!: { [key: string]: BillingSettings };
      @hy(PaymentInfo) paymentInfo!: PaymentInfo;
    }

    const defaultModel: BillingConfigurationModel = {
      settings: {
        CELLULAR: {
          permissions: ['A', 'SA'],
          directBill: false,
        },
        STORAGE: {
          permissions: ['A', 'SA'],
          directBill: false,
        },
        LEAK_MONITORING: {
          permissions: ['A', 'SA'],
          directBill: false,
        },
      },
      paymentInfo: {
        cards: [],
      },
    };

    it('Should be able to diff the nested Hydratable things have the diff in the right order (leftToRight)', () => {
      const beforeModel = { ...defaultModel };
      const afterModel = {
        ...defaultModel,
        settings: {
          ...defaultModel.settings,
          STORAGE: {
            ...defaultModel.settings.STORAGE,
            waived: true,
          },
          LEAK_MONITORING: {
            ...defaultModel.settings.LEAK_MONITORING,
            directBill: true,
            permissions: ['A', 'SA', 'T'],
          },
          MANUAL_READS: {
            permissions: ['A'],
            directBill: true,
          },
        },
      };
      const before = new BillingConfiguration(beforeModel);
      assert.isUndefined(before.settings.STORAGE.waived);
      const after = new BillingConfiguration(afterModel);
      assert.isTrue(after.settings.STORAGE.waived);
      const diff = before.diff(after);
      assert.deepEqual((diff.settings as Record<string, unknown>)['STORAGE'], { waived: [undefined, true] });
      assert.deepEqual((diff.settings as Record<string, unknown>)['LEAK_MONITORING'], { permissions: { '2': [undefined, 'T'] }, directBill: [false, true] });
      assert.deepEqual((diff.settings as Record<string, unknown>)['MANUAL_READS'], [undefined, { permissions: ['A'], directBill: true }]);
    });
  });
});
