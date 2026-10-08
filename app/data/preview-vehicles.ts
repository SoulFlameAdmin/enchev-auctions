// Temporary read-only demo catalog for ENCHEV lot details.
// Do not interpret these fixtures as authenticated production inventory.
export type PreviewVehicle = {
  title: string;
  vin: string;
  mileage: string;
  damage: string;
  titleStatus: string;
  location: string;
  image: string;
  price: number;
  buyNow: number;
};
export const PREVIEW_VEHICLES: Record<string, PreviewVehicle> = {
  "EA-10482": {title:"2018 BMW M4 F82",vin:"WBS3R9C50JAK10482",mileage:"82 410 km",damage:"Minor dents",titleStatus:"Clean",location:"Sofia, BG",image:"https://images.unsplash.com/photo-1658558195433-1af533e3309c?auto=format&fit=crop&w=1200&q=82",price:12750,buyNow:18900},
  "EA-10511": {title:"2021 Mercedes-Benz GLC",vin:"WDC0G4KB1MF10511",mileage:"64 900 km",damage:"Front end",titleStatus:"Salvage",location:"Munich, DE",image:"https://images.unsplash.com/photo-1612280782903-d34dcdc10107?auto=format&fit=crop&w=1200&q=82",price:18400,buyNow:24900},
  "EA-10539": {title:"2022 Audi RS3 Sportback",vin:"WUAZZZ8Y2NA10539",mileage:"41 280 km",damage:"Minor scratches",titleStatus:"Clean",location:"Crewe, UK",image:"https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1200&q=82",price:21900,buyNow:0},
  "EA-10603": {title:"2026 Volkswagen Golf GTI",vin:"WVWZZZCD6TW10603",mileage:"9 870 km",damage:"Clean title",titleStatus:"Clean",location:"London, UK",image:"https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1200&q=82",price:16250,buyNow:20500},
  "EA-10627": {title:"2020 BMW X5 xDrive40i",vin:"5UXCR6C02L910627",mileage:"96 210 km",damage:"Rear end",titleStatus:"Salvage",location:"Texas, USA",image:"https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=82",price:15100,buyNow:22400},
  "EA-10644": {title:"2019 Mercedes-AMG C43",vin:"WDDWJ6EB5KF10644",mileage:"72 030 km",damage:"Side",titleStatus:"Salvage",location:"Florida, USA",image:"https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=82",price:13800,buyNow:19800},
  "EA-10671": {title:"2021 Audi Q7 55 TFSI",vin:"WA1LXAF75MD10671",mileage:"58 440 km",damage:"Normal wear",titleStatus:"Clean",location:"New Jersey, USA",image:"https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?auto=format&fit=crop&w=1200&q=82",price:19900,buyNow:26900},
  "EA-10702": {title:"2023 Porsche Macan S",vin:"WP1AB2A59PL10702",mileage:"21 540 km",damage:"Front end",titleStatus:"Salvage",location:"California, USA",image:"https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=1200&q=82",price:28750,buyNow:0},
};
