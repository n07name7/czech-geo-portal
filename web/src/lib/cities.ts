export interface CityConfig {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
  boundaryFile: string;
}

export const CITIES: CityConfig[] = [
  { id: "praha",            name: "Praha",             center: [14.437, 50.073], zoom: 12, boundaryFile: "/prague-boundary.geojson" },
  { id: "brno",             name: "Brno",              center: [16.608, 49.195], zoom: 12, boundaryFile: "/brno-boundary.geojson" },
  { id: "ostrava",          name: "Ostrava",           center: [18.292, 49.820], zoom: 12, boundaryFile: "/ostrava-boundary.geojson" },
  { id: "plzen",            name: "Plzeň",             center: [13.377, 49.738], zoom: 12, boundaryFile: "/plzen-boundary.geojson" },
  { id: "liberec",          name: "Liberec",           center: [15.057, 50.767], zoom: 13, boundaryFile: "/liberec-boundary.geojson" },
  { id: "olomouc",          name: "Olomouc",           center: [17.251, 49.593], zoom: 13, boundaryFile: "/olomouc-boundary.geojson" },
  { id: "ceske_budejovice", name: "České Budějovice",  center: [14.475, 48.975], zoom: 13, boundaryFile: "/ceske_budejovice-boundary.geojson" },
  { id: "hradec_kralove",   name: "Hradec Králové",    center: [15.832, 50.209], zoom: 13, boundaryFile: "/hradec_kralove-boundary.geojson" },
];

export const DEFAULT_CITY = CITIES[0];
