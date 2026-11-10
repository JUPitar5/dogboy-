export interface FieldScene {
  id: number;
  position: number;
  name: string;
  src: string;
  ground: number;
  landmarks: number[][];
  morphTravel?: number;
}

type Registry = Record<number, Record<string, any>>;
type FieldElements = { root: HTMLElement; stage: HTMLElement; hero: HTMLElement; mast: HTMLElement; track: HTMLElement; entries: unknown[] };
let modulesPromise: Promise<Registry> | null = null;

async function getModules(scenes: FieldScene[]) {
  if (modulesPromise) return modulesPromise;
  modulesPromise = (async () => {
    const modules: Registry = {};
    let duskUntil = 0;
    modules[67659] = {
      onDusk(callback: () => void) {
        const listener = () => { duskUntil = performance.now() + 1100; callback(); };
        window.addEventListener('bb:dusk', listener);
        return () => window.removeEventListener('bb:dusk', listener);
      },
      driversNow() {
        const style = getComputedStyle(document.documentElement);
        return { night: parseFloat(style.getPropertyValue('--night')) || 0, gold: 0 };
      },
      blend(day: number, dusk: number, night: number, driver: { night: number; gold: number }) {
        return (day * (1 - driver.night) + night * driver.night) * (1 - driver.gold) + dusk * driver.gold;
      },
      duskAnimation: () => performance.now() < duskUntil,
    };
    const registry = {
      i(id: number) { if (!modules[id]) throw new Error(`Field module ${id} is unavailable`); return modules[id]; },
      s(values: any[], id: number) {
        modules[id] ||= {};
        for (let i = 0; i < values.length; i += 3) {
          if (values[i + 1] === 0) modules[id][values[i]] = values[i + 2];
          else Object.defineProperty(modules[id], values[i], { get: values[i + 2] });
        }
      },
    };
    const enginePath = '/field/engine.js';
    const clearingPath = '/field/clearing.js';
    const [engine, clearing] = await Promise.all([import(/* @vite-ignore */ enginePath), import(/* @vite-ignore */ clearingPath)]);
    engine.register(registry);
    clearing.register(registry, scenes);
    return modules;
  })();
  return modulesPromise;
}

export async function mountField(elements: FieldElements, scenes: FieldScene[]): Promise<() => void> {
  const modules = await getModules(scenes);
  return modules[24994].mountClearing(elements);
}
