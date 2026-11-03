export type Stage0TutorialStepId =
  | 'move' | 'run' | 'pick-wheat' | 'drop-wheat' | 'intake-wheat'
  | 'mill-processing' | 'intake-flour' | 'move-heater' | 'heater-processing'
  | 'submit-bread' | 'stage1-handoff';

export type TutorialObservedEvent = Readonly<
  | { kind: 'moved'; running: boolean }
  | { kind: 'material-picked'; materialType: 'wheat' | 'flour' | 'bread'; materialId: string }
  | { kind: 'material-dropped'; materialType: 'wheat' | 'flour' | 'bread'; materialIds: readonly string[] }
  | { kind: 'material-intake'; materialType: 'wheat' | 'flour'; materialId: string; blockId: string }
  | { kind: 'block-moved'; blockId: string }
  | { kind: 'material-output'; materialType: 'flour' | 'bread'; materialIds: readonly string[] }
  | { kind: 'bread-submitted'; materialId: string }
>;

export interface TutorialStepDefinition {
  readonly id: Stage0TutorialStepId;
  readonly text: string;
  readonly keycaps: readonly string[];
  readonly cardVisible: boolean;
  readonly accepts: (event: TutorialObservedEvent, controller: Stage0TutorialController) => boolean;
  readonly effect?: () => void;
}
export interface TutorialSurface {
  hidden: boolean;
  textContent: string | null;
  readonly dataset: Record<string, string> | DOMStringMap;
  setAttribute(name: string, value: string): void;
  replaceChildren(...nodes: (Node | string)[]): void;
}

const is = <K extends TutorialObservedEvent['kind']>(kind: K,
  predicate?: (event: Extract<TutorialObservedEvent, { kind: K }>, controller: Stage0TutorialController) => boolean) =>
  (event: TutorialObservedEvent, controller: Stage0TutorialController): boolean =>
    event.kind === kind && (predicate?.(event as Extract<TutorialObservedEvent, { kind: K }>, controller) ?? true);

export function createStage0TutorialSteps(effects: Readonly<{
  revealPipe: () => void; revealMill: () => void; revealHeater: () => void; revealDock: () => void;
}>): readonly TutorialStepDefinition[] {
  return Object.freeze([
    Object.freeze({ id: 'move', text: '방향키로 움직여 보세요.', keycaps: ['ARROWUP', 'ARROWLEFT', 'ARROWDOWN', 'ARROWRIGHT'], cardVisible: true,
      accepts: is('moved', (event) => !event.running) }),
    Object.freeze({ id: 'run', text: 'Shift를 누른 상태로 움직여 달릴 수 있습니다.', keycaps: ['SHIFT'], cardVisible: true,
      accepts: is('moved', (event) => event.running), effect: effects.revealPipe }),
    Object.freeze({ id: 'pick-wheat', text: '밀 파이프에선 밀이 나옵니다. E로 집어 보세요. E를 누르고 있으면 한 번에 5개까지 차례로 들 수 있습니다.', keycaps: ['E'], cardVisible: true,
      accepts: is('material-picked', (event) => event.materialType === 'wheat') }),
    Object.freeze({ id: 'drop-wheat', text: 'Q를 눌러 바닥에 놓을 수 있습니다.', keycaps: ['Q'], cardVisible: true,
      accepts: is('material-dropped', (event, controller) => event.materialType === 'wheat' && event.materialIds.includes(controller.pickedWheatId ?? '')), effect: effects.revealMill }),
    Object.freeze({ id: 'intake-wheat', text: '블록 근처에서 밀을 들고 Q를 눌러 재료를 넣으세요.', keycaps: ['Q'], cardVisible: true,
      accepts: is('material-intake', (event, controller) => event.materialType === 'wheat' && event.blockId === 'mill' && event.materialId === controller.pickedWheatId && controller.isEligibleAutomaticIntake(event.materialId)) }),
    Object.freeze({ id: 'mill-processing', text: '시간이 지나면 밀가루가 나옵니다.', keycaps: [], cardVisible: true,
      accepts: is('material-output', (event) => event.materialType === 'flour'), effect: effects.revealHeater }),
    Object.freeze({ id: 'intake-flour', text: '밀가루를 굽기 블록에 넣으세요.', keycaps: [], cardVisible: true,
      accepts: is('material-intake', (event, controller) => event.materialType === 'flour' && event.blockId === 'heater' && controller.isExpectedFlour(event.materialId) && controller.isEligibleAutomaticIntake(event.materialId)) }),
    Object.freeze({ id: 'move-heater', text: 'Space를 눌러 블록 위치를 옮길 수 있습니다.', keycaps: ['SPACE'], cardVisible: true,
      accepts: is('block-moved', (event) => event.blockId === 'heater') }),
    Object.freeze({ id: 'heater-processing', text: '빵을 제출대에 넣으세요!', keycaps: [], cardVisible: true,
      accepts: is('material-output', (event) => event.materialType === 'bread'), effect: effects.revealDock }),
    Object.freeze({ id: 'submit-bread', text: '빵을 제출대에 넣으세요!', keycaps: [], cardVisible: true,
      accepts: is('bread-submitted', (event, controller) => controller.isExpectedBread(event.materialId) && controller.isEligibleAutomaticIntake(event.materialId)) }),
    Object.freeze({ id: 'stage1-handoff', text: '', keycaps: [], cardVisible: false, accepts: () => false }),
  ]);
}

export class Stage0TutorialController {
  private index = 0;
  private wheatId: string | null = null;
  private readonly expectedFlourIds = new Set<string>();
  private readonly expectedBreadIds = new Set<string>();
  private readonly eligibleAutomaticIntakeIds = new Set<string>();
  private heaterUnlocked = false;
  constructor(private readonly surface: TutorialSurface, readonly steps: readonly TutorialStepDefinition[]) {
    if (steps.length !== 11 || steps.filter((step) => step.cardVisible).length !== 10) throw new Error('Stage 0 tutorial requires eleven ordered steps and ten cards.');
    this.render();
  }
  observe(event: TutorialObservedEvent): boolean {
    const step = this.steps[this.index];
    if (step?.id === 'intake-wheat' && event.kind === 'material-dropped' && event.materialType === 'wheat' && this.wheatId !== null && event.materialIds.includes(this.wheatId)) {
      this.eligibleAutomaticIntakeIds.add(this.wheatId);
    }
    if (step?.id === 'intake-flour' && event.kind === 'material-dropped' && event.materialType === 'flour') {
      for (const id of event.materialIds) if (this.expectedFlourIds.has(id)) this.eligibleAutomaticIntakeIds.add(id);
    }
    if (step?.id === 'submit-bread' && event.kind === 'material-dropped' && event.materialType === 'bread') {
      for (const id of event.materialIds) if (this.expectedBreadIds.has(id)) this.eligibleAutomaticIntakeIds.add(id);
    }
    if (step === undefined || !step.accepts(event, this)) return false;
    if (step.id === 'pick-wheat' && event.kind === 'material-picked') this.wheatId = event.materialId;
    if (step.id === 'mill-processing' && event.kind === 'material-output') for (const id of event.materialIds) this.expectedFlourIds.add(id);
    if (step.id === 'heater-processing' && event.kind === 'material-output') for (const id of event.materialIds) this.expectedBreadIds.add(id);
    if (step.id === 'move-heater') this.heaterUnlocked = true;
    if (event.kind === 'material-intake' || event.kind === 'bread-submitted') this.eligibleAutomaticIntakeIds.delete(event.materialId);
    step.effect?.(); this.index += 1; this.render(); return true;
  }
  allowsAutomaticIntake(materialId: string): boolean { return this.eligibleAutomaticIntakeIds.has(materialId); }
  isEligibleAutomaticIntake(materialId: string): boolean { return this.eligibleAutomaticIntakeIds.has(materialId); }
  isExpectedFlour(materialId: string): boolean { return this.expectedFlourIds.has(materialId); }
  isExpectedBread(materialId: string): boolean { return this.expectedBreadIds.has(materialId); }
  get heaterProcessingUnlocked(): boolean { return this.heaterUnlocked; }
  allowsBlockCapture(blockId: string): boolean {
    if (this.heaterUnlocked) return true;
    return this.currentStepId === 'move-heater' && blockId === 'heater';
  }
  get pickedWheatId(): string | null { return this.wheatId; }
  reset(): void { this.index = 0; this.wheatId = null; this.heaterUnlocked = false; this.expectedFlourIds.clear(); this.expectedBreadIds.clear(); this.eligibleAutomaticIntakeIds.clear(); this.render(); }
  complete(): void { this.index = this.steps.length - 1; this.wheatId = null; this.heaterUnlocked = true; this.expectedFlourIds.clear(); this.expectedBreadIds.clear(); this.eligibleAutomaticIntakeIds.clear(); this.render(); }
  get currentStepId(): Stage0TutorialStepId { return this.steps[this.index]?.id ?? 'stage1-handoff'; }
  dispose(): void { this.surface.hidden = true; this.surface.replaceChildren(); this.wheatId = null; this.expectedFlourIds.clear(); this.expectedBreadIds.clear(); this.eligibleAutomaticIntakeIds.clear(); }
  private render(): void {
    const step = this.steps[this.index];
    if (step === undefined || !step.cardVisible) { this.surface.hidden = true; this.surface.setAttribute('aria-hidden', 'true'); return; }
    if (typeof document === 'undefined') this.surface.textContent = `${step.text}${step.keycaps.length > 0 ? `  ${step.keycaps.join(' · ')}` : ''}`;
    else {
      const nodes: Node[] = [];
      const addText = (value: string): void => { const text = document.createElement('span'); text.textContent = value; nodes.push(text); };
      const addLineBreak = (): void => { const lineBreak = document.createElement('br'); lineBreak.className = 'campaign-tutorial-line-break'; nodes.push(lineBreak); };
      const addKey = (label: string): void => {
        const key = document.createElement('span'); key.className = `campaign-keycap campaign-keycap--${label.toLowerCase()}`;
        key.setAttribute('role', 'img'); key.setAttribute('aria-label', label); nodes.push(key);
      };
      if (step.id === 'move') { for (const label of step.keycaps) addKey(label); addText('로 움직여 보세요.'); }
      else if (step.id === 'run') { addKey('SHIFT'); addText('를 누른 상태로 움직여 달릴 수 있습니다.'); }
      else if (step.id === 'pick-wheat') { addText('밀 파이프에선 밀이 나옵니다.'); addKey('E'); addText('로 집어 보세요.'); addLineBreak(); addKey('E'); addText('를 누르고 있으면 한 번에 5개까지 차례로 들 수 있습니다.'); }
      else if (step.id === 'drop-wheat') { addKey('Q'); addText('를 눌러 바닥에 놓을 수 있습니다.'); }
      else if (step.id === 'intake-wheat') { addText('블록 근처에서 밀을 들고 '); addKey('Q'); addText('를 눌러 재료를 넣으세요.'); }
      else if (step.id === 'intake-flour') addText('밀가루를 굽기 블록에 넣으세요.');
      else if (step.id === 'move-heater') { addKey('SPACE'); addText('를 눌러 블록 위치를 옮길 수 있습니다.'); }
      else addText(step.text);
      this.surface.replaceChildren(...nodes);
    }
    this.surface.setAttribute('aria-label', step.text);
    this.surface.dataset.stage0TutorialStep = step.id;
    this.surface.hidden = false; this.surface.setAttribute('aria-live', 'polite'); this.surface.setAttribute('aria-hidden', 'false');
  }
}
