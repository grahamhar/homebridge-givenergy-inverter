import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';


import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {GivEnergyInverterAccessory} from './platformAccessory';
import axios from 'axios';
import getInverterSettings from './utils';

interface battery {
  percent: number;
  power: number;
  scheduledCharge: boolean;
  scheduledDischarge: boolean;
}

interface grid {
  power: number;
}
interface solar {
  power: number;
}

interface GivEnergyInverter {
  serialNumber: string;
  displayName: string;
  model: string;
  battery: battery;
  grid: grid;
  solar: solar;
  ecoMode: boolean;
}
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class GivEnergyPlugin implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {

    const serialNumbers = await axios.get('https://api.givenergy.cloud/v1/communication-device', {headers: {
      'Authorization': 'Bearer ' + this.config.API_KEY,
      'accept': 'application/json',
    }, timeout: 5000}).then( response => {
      const serials: any = [];
      response.data.data.forEach(inverter => {
        this.log.info('Found inverter: ' + JSON.stringify(inverter.inverter));
        this.log.info('Found inverter: ' + inverter.inverter.serial);
        serials.push({serial: inverter.inverter.serial, model: inverter.inverter.info.model});
      });
      return serials;
    }).catch(error => {
      this.log.error(error);
    });

    for (const inverter of serialNumbers) {
      const [scheduleImportEnabled, scheduleExportEnabled, ecoEnabled] = await getInverterSettings(inverter.serial, this.config.API_KEY);
      axios.get(`https://api.givenergy.cloud/v1/inverter/${inverter.serial}/system-data/latest`, {headers: {
        'Authorization': 'Bearer ' + this.config.API_KEY,
        'accept': 'application/json',
      }, timeout: 5000}).then(response => {
        this.log.info('Found inverter details: ' + JSON.stringify(response.data));
        const givInverter: GivEnergyInverter = {
          serialNumber: inverter.serial,
          displayName: inverter.serial,
          model: inverter.model,
          battery: {
            percent: response.data.data.battery.percent,
            power: response.data.data.battery.power,
            scheduledCharge: scheduleExportEnabled,
            scheduledDischarge: scheduleImportEnabled,
          },
          grid: {
            power: response.data.data.grid.power,
          },
          solar: {
            power: response.data.data.solar.power,
          },
          ecoMode: ecoEnabled,
        };
        const uuid = this.api.hap.uuid.generate(givInverter.serialNumber);
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
        if (existingAccessory) {

          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          existingAccessory.context.device = givInverter;
          new GivEnergyInverterAccessory(this, existingAccessory);

        } else {
          this.log.info('Adding new accessory:', givInverter.displayName);
          this.log.debug('Adding new accessory:', JSON.stringify(givInverter));

          const accessory = new this.api.platformAccessory(givInverter.displayName, uuid);

          accessory.context.device = givInverter;

          new GivEnergyInverterAccessory(this, accessory);

          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }).catch(error => {
        this.log.error(error);
      });
    }

  }
}
