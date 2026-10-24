import type {PricingTier} from './types.ts';
export function calculatorTiers(tiers:PricingTier[],categoryId:string,isDTF:boolean,preset:'A4'|'A3'|null):PricingTier[]{
 return tiers.filter(t=>t.categoryId===categoryId&&(!isDTF||(t.preset||null)===preset));
}
export function dimensionPrice(area:number,value:number,isSheet:boolean):number{
 return isSheet?value:Math.round(area*value);
}
