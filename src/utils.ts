import axios from 'axios';

export default async function getInverterSettings(inverterSerial: string, apiKey: string): Promise<[boolean, boolean, boolean]> {
  const chargeEnabled: Promise<boolean> = axios.post(
    `https://api.givenergy.cloud/v1/inverter/${inverterSerial}/settings/66/read`, {'context': 'homebridge'}, {headers: {
      'Authorization': 'Bearer ' +apiKey,
      'accept': 'application/json',
    }, timeout: 5000},
  ).then(response => {
    return response.data.data.value;
  }).catch(error => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(error));
    throw error;
  });
  const exportEnabled: Promise<boolean> = axios.post(
    `https://api.givenergy.cloud/v1/inverter/${inverterSerial}/settings/56/read`, {'context': 'homebridge'}, {headers: {
      'Authorization': 'Bearer ' +apiKey,
      'accept': 'application/json',
    }, timeout: 5000},
  ).then(response => {
    // eslint-disable-next-line no-console
    console.log(response.data);
    return response.data.data.value;
  }).catch(error => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(error));
    throw error;
  });
  const ecoEnabled: Promise<boolean> = axios.post(
    `https://api.givenergy.cloud/v1/inverter/${inverterSerial}/settings/24/read`, {'context': 'homebridge'}, {headers: {
      'Authorization': 'Bearer ' +apiKey,
      'accept': 'application/json',
    }, timeout: 5000},
  ).then(response => {
    // eslint-disable-next-line no-console
    console.log(response.data);
    return response.data.data.value;
  }).catch(error => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(error));
    throw error;
  });
  return [(await chargeEnabled), (await exportEnabled), (await ecoEnabled)];
}
