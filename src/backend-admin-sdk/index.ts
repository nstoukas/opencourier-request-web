export enum MerchantUserCreateAdminInputRoleEnum {
  MerchantGroupAdmin = 'MERCHANT_GROUP_ADMIN',
  MerchantLocationManager = 'MERCHANT_LOCATION_MANAGER',
}

export enum MerchantUserAdminDtoRoleEnum {
  MERCHANT_GROUP_ADMIN = 'MERCHANT_GROUP_ADMIN',
  MERCHANT_LOCATION_MANAGER = 'MERCHANT_LOCATION_MANAGER',
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

export type DeliveryAdminDto = {
  id: string
  status?: string
}
