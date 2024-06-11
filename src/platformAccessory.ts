import { Service, PlatformAccessory } from 'homebridge';

import { GivEnergyPlugin } from './platform';
import axios from 'axios';
// import getInverterSettings from './utils';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class GivEnergyInverterAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private inverterStates = {
    serial: this.accessory.context.device.serialNumber,
    On: this.accessory.context.device.solar.power > 0,
    batteryPercent: this.accessory.context.device.battery.percent,
    batteryPower: this.accessory.context.device.battery.power,
    arrayPower: this.accessory.context.device.solar.power,
    gridPower: this.accessory.context.device.grid.power,
    scheduledCharge: this.accessory.context.device.battery.scheduledCharge,
    scheduledDischarge: this.accessory.context.device.battery.scheduledDischarge,
    ecoMode: this.accessory.context.ecoEnabled,
  };

  constructor(
    private readonly platform: GivEnergyPlugin,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.platform.log.debug('Setting accessory information:' + JSON.stringify(this.accessory.context.device));
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'GivEnergy')
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.device.model)
      .setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.device.serialNumber)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.device.serialNumber);

    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
    this.service.getCharacteristic(this.platform.Characteristic.On).onGet(this.getInverterOn.bind(this));

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, accessory.context.device.displayName);
    const gridExportService = this.accessory.getService('Grid Export') ||
      this.accessory.addService(this.platform.Service.LightSensor, 'Grid Export', 'Grid-Export');
    gridExportService.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'GridExport');

    const gridImportService = this.accessory.getService('Grid Import') ||
      this.accessory.addService(this.platform.Service.LightSensor, 'Grid Import', 'Grid-Import');
    gridImportService.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'GridImport');

    const solarService = this.accessory.getService('Solar') ||
      this.accessory.addService(this.platform.Service.LightSensor, 'Solar', 'Solar');
    solarService.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Solar');

    const batteryService = this.accessory.getService('Battery') ||
      this.accessory.addService(this.platform.Service.Battery, 'Battery', 'Battery');
    batteryService.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Battery');

    const scheduledCharge = this.accessory.getService('Scheduled Charge') ||
      this.accessory.addService(this.platform.Service.Lightbulb, 'Scheduled Charge', 'Scheduled-Charge');
    scheduledCharge.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'ScheduledCharge');

    const scheduledExport = this.accessory.getService('Scheduled Export') ||
      this.accessory.addService(this.platform.Service.Lightbulb, 'Scheduled Export', 'Scheduled-Export');
    scheduledExport.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'ScheduledExport');

    const ecoMode = this.accessory.getService('Eco Mode') ||
      this.accessory.addService(this.platform.Service.Lightbulb, 'Eco Mode', 'Eco-Mode');
    ecoMode.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'EcoMode');

    this.accessory.addService(this.platform.Service.PowerManagement);
    gridExportService.name = 'Grid Export';

    gridImportService.name = 'Grid Import';

    solarService.name = 'Solar';

    batteryService.name = 'Battery';

    scheduledCharge.name = 'Scheduled Charge';

    scheduledExport.name = 'Scheduled Export';

    ecoMode.name = 'Eco Mode';

    gridImportService.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
      .onGet(this.getGridImport.bind(this));

    gridExportService.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
      .onGet(this.getGridExport.bind(this));

    solarService.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
      .onGet(this.getSolar.bind(this));

    batteryService.getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .onGet(this.getBatteryPercent.bind(this));

    batteryService.getCharacteristic(this.platform.Characteristic.ChargingState)
      .onGet(this.getChargeState.bind(this));

    batteryService.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
      .onGet(this.handleStatusLowBatteryGet.bind(this));

    scheduledCharge.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getScheduledCharge.bind(this));

    scheduledExport.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getScheduledExport.bind(this));

    ecoMode.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getEcoMode.bind(this));


    setInterval(() => {
      axios.get(`https://api.givenergy.cloud/v1/inverter/${this.inverterStates.serial}/system-data/latest`, {headers: {
        'Authorization': 'Bearer ' + this.platform.config.API_KEY,
        'accept': 'application/json',
      }, timeout: 5000}).then(response => {
        this.inverterStates.On = response.data.data.solar.power > 0;
        this.inverterStates.batteryPercent = response.data.data.battery.percent;
        this.inverterStates.batteryPower = response.data.data.battery.power;
        this.inverterStates.arrayPower = response.data.data.solar.power;
        this.inverterStates.gridPower = response.data.data.grid.power;
      }).catch(error => {
        this.platform.log.error(error);
      });
      axios.post(
        `https://api.givenergy.cloud/v1/inverter/${this.inverterStates.serial}/settings/66/read`, {'context': 'homebridge'}, {headers: {
          'Authorization': 'Bearer ' +this.platform.config.API_KEY,
          'accept': 'application/json',
        }, timeout: 5000},
      ).then(response => {
        this.inverterStates.scheduledCharge = response.data.data.value;
      }).catch(error => {
        this.platform.log.info(JSON.stringify(error));
      });
      axios.post(
        `https://api.givenergy.cloud/v1/inverter/${this.inverterStates.serial}/settings/56/read`, {'context': 'homebridge'}, {headers: {
          'Authorization': 'Bearer ' +this.platform.config.API_KEY,
          'accept': 'application/json',
        }, timeout: 5000},
      ).then(response => {
        this.inverterStates.scheduledDischarge = response.data.data.value;
      }).catch(error => {
        this.platform.log.info(JSON.stringify(error));
      });
      axios.post(
        `https://api.givenergy.cloud/v1/inverter/${this.inverterStates.serial}/settings/24/read`, {'context': 'homebridge'}, {headers: {
          'Authorization': 'Bearer ' +this.platform.config.API_KEY,
          'accept': 'application/json',
        }, timeout: 5000},
      ).then(response => {
        this.inverterStates.ecoMode = response.data.data.value;
      }).catch(error => {
        this.platform.log.info(JSON.stringify(error));
      });
      this.service.updateCharacteristic(this.platform.Characteristic.On, this.inverterStates.On);
      batteryService.updateCharacteristic(this.platform.Characteristic.ChargingState,
        this.inverterStates.batteryPower < 0 ? this.platform.Characteristic.ChargingState.CHARGING :
          this.platform.Characteristic.ChargingState.NOT_CHARGING);
      batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.inverterStates.batteryPercent);
      gridImportService.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel,
        this.inverterStates.gridPower < 0 ? -1 * this.inverterStates.gridPower : 0.0001);
      gridExportService.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel,
        this.inverterStates.gridPower > 0 ? this.inverterStates.gridPower : 0.0001);
      solarService.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel,
        this.inverterStates.arrayPower > 0 ? this.inverterStates.arrayPower : 0.0001);
      scheduledCharge.updateCharacteristic(this.platform.Characteristic.On, this.inverterStates.scheduledCharge);
      scheduledExport.updateCharacteristic(this.platform.Characteristic.On, this.inverterStates.scheduledDischarge);
      ecoMode.updateCharacteristic(this.platform.Characteristic.On, this.inverterStates.ecoMode);
      this.platform.log.debug('Updating data:', JSON.stringify(this.inverterStates));
      this.platform.log.debug('Solar power:', this.inverterStates.arrayPower);
    }, 20000);
  }



  async getBatteryPercent() {
    return this.inverterStates.batteryPercent;
  }

  async handleStatusLowBatteryGet() {
    this.platform.log.debug('Triggered GET StatusLowBattery');
    return this.inverterStates.batteryPercent > 30 ?
      this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL :
      this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
  }

  async getChargeState(){
    this.platform.log.debug('Triggered GET ChargingState');
    return this.inverterStates.batteryPower < 0 ?
      this.platform.Characteristic.ChargingState.CHARGING :
      this.platform.Characteristic.ChargingState.NOT_CHARGING;
  }

  async getGridImport() {
    this.platform.log.debug('Triggered GET Grid import level');
    return this.inverterStates.gridPower < 0 ? -1 * this.inverterStates.gridPower : 0.0001;
  }

  async getGridExport() {
    this.platform.log.debug('Triggered GET Grid export level');
    return this.inverterStates.gridPower > 0 ? this.inverterStates.gridPower : 0.0001;
  }

  async getSolar() {
    this.platform.log.debug('Triggered GET Grid export level');
    return this.inverterStates.arrayPower > 0 ? this.inverterStates.arrayPower : 0.0001;
  }

  async getInverterOn() {
    this.platform.log.debug('Triggered GET InverterOn');
    return this.inverterStates.On;
  }

  async getScheduledCharge() {
    this.platform.log.debug('Triggered GET ScheduledCharge');
    return this.inverterStates.scheduledCharge;
  }

  async getScheduledExport() {
    this.platform.log.debug('Triggered GET ScheduledExport');
    return this.inverterStates.scheduledDischarge;
  }

  async getEcoMode() {
    this.platform.log.debug('Triggered GET EcoMode');
    return this.inverterStates.ecoMode;
  }
}

