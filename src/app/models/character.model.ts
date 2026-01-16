export interface Character {
  identity: {
    name: string;
    type: string;
    age: string;
    description: string;
    favoriteSong: string;
    drive: string;
    problem: string;
    pride: string;
    anchor: string;
  };
  stats: {
    body: number;
    tech: number;
    heart: number;
    mind: number;
  };
  skills: {
    sneak: number;
    force: number;
    move: number;
    tinker: number;
    program: number;
    calculate: number;
    contact: number;
    charm: number;
    lead: number;
    investigate: number;
    comprehend: number;
    empathize: number;
  };
  luck: number;
  experience: number;
  conditions: {
    upset: boolean;
    scared: boolean;
    exhausted: boolean;
    injured: boolean;
    broken: boolean;
  };
  relationships: { label: string; name: string }[];
  items: { name: string; uses: boolean[] }[];
  notes: string;
  hideout: string;
}

export function createDefaultCharacter(): Character {
  return {
    identity: {
      name: '',
      type: '',
      age: '',
      description: '',
      favoriteSong: '',
      drive: '',
      problem: '',
      pride: '',
      anchor: '',
    },
    stats: { body: 0, tech: 0, heart: 0, mind: 0 },
    skills: {
      sneak: 0,
      force: 0,
      move: 0,
      tinker: 0,
      program: 0,
      calculate: 0,
      contact: 0,
      charm: 0,
      lead: 0,
      investigate: 0,
      comprehend: 0,
      empathize: 0,
    },
    luck: 0,
    experience: 0,
    conditions: {
      upset: false,
      scared: false,
      exhausted: false,
      injured: false,
      broken: false,
    },
    relationships: [
      { label: 'Kid 1', name: '' },
      { label: 'Kid 2', name: '' },
      { label: 'Kid 3', name: '' },
      { label: 'Kid 4', name: '' },
      { label: 'NPC 1', name: '' },
      { label: 'NPC 2', name: '' },
    ],
    items: [
      { name: '', uses: [false, false, false] },
      { name: '', uses: [false, false, false] },
      { name: '', uses: [false, false, false] },
      { name: '', uses: [false, false, false] },
    ],
    notes: '',
    hideout: '',
  };
}
