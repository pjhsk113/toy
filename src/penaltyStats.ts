/**
 * 벌칙(당첨금액) 기록 및 통계 관리 모듈.
 *
 * 게임 종료(goal) 시 당첨자 1명과 벌칙 금액을 localStorage 에 누적 기록하고,
 * 이름별 누적 통계를 조회한다. 게임 로직과 독립적인 순수 추가 기능이다.
 *
 * 레코드에는 고유 ID가 없다. 잘못 기록된 항목을 지목하기 위해 조회 시점에
 * 저장 배열의 원본 위치(index)를 함께 실어 보내고, 수정/삭제는 그 위치로 수행한다.
 * 저장 스키마를 바꾸지 않으므로 기존 사용자의 기록이 마이그레이션 없이 그대로 유지된다.
 */

const STORAGE_KEY = 'mbr_penalty_records';

export interface PenaltyRecord {
  name: string;
  amount: number;
  date: string; // ISO 8601
}

/** 조회용 레코드. index 는 저장 배열에서의 원본 위치이며 수정/삭제의 지목에 쓰인다. */
export interface PenaltyRecordView extends PenaltyRecord {
  index: number;
}

export interface PenaltySummaryRow {
  name: string;
  count: number;
  total: number;
}

/** 수정 시 변경할 필드. 생략된 필드는 기존 값을 유지한다. */
export interface PenaltyRecordChanges {
  name?: string;
  amount?: number;
}

function readRecords(): PenaltyRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is PenaltyRecord =>
        !!r && typeof r.name === 'string' && typeof r.amount === 'number' && typeof r.date === 'string'
    );
  } catch (e) {
    console.error('벌칙 기록을 불러오지 못했습니다:', e);
    return [];
  }
}

function writeRecords(records: PenaltyRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('벌칙 기록을 저장하지 못했습니다:', e);
  }
}

/** 유효한 금액이면 정수로 내림해 반환하고, 그렇지 않으면 null 을 반환한다. */
function normalizeAmount(amount: number): number | null {
  return Number.isFinite(amount) && amount >= 0 ? Math.floor(amount) : null;
}

function isValidIndex(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

export class PenaltyStats {
  /**
   * 당첨자 1건을 기록한다. 불변 패턴으로 새 배열을 만들어 저장한다.
   * @returns 추가된 레코드. 입력이 유효하지 않으면 null.
   */
  addRecord(name: string, amount: number, date: Date = new Date()): PenaltyRecord | null {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      console.warn('당첨자 이름이 비어 있어 기록하지 않습니다.');
      return null;
    }
    const safeAmount = normalizeAmount(amount) ?? 0;

    const record: PenaltyRecord = {
      name: trimmed,
      amount: safeAmount,
      date: date.toISOString(),
    };

    writeRecords([...readRecords(), record]);
    return record;
  }

  /** 최신순으로 정렬된 전체 기록을 반환한다. 각 항목은 원본 위치(index)를 함께 담는다. */
  getRecords(): PenaltyRecordView[] {
    return readRecords()
      .map((r, index) => ({ ...r, index }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * 지정한 위치의 기록에서 이름/금액을 수정한다. 날짜는 변경하지 않는다.
   * 잘못된 값으로 기존 기록을 덮어쓰지 않도록, 입력이 유효하지 않으면 저장하지 않고 false 를 반환한다.
   * @param index getRecords() 가 돌려준 원본 위치
   * @returns 수정에 성공하면 true
   */
  updateRecord(index: number, changes: PenaltyRecordChanges): boolean {
    const records = readRecords();
    if (!isValidIndex(index, records.length)) {
      console.warn('수정할 벌칙 기록을 찾지 못했습니다:', index);
      return false;
    }

    const current = records[index];

    const nextName = changes.name === undefined ? current.name : (changes.name ?? '').trim();
    if (!nextName) {
      console.warn('당첨자 이름이 비어 있어 수정하지 않습니다.');
      return false;
    }

    const nextAmount = changes.amount === undefined ? current.amount : normalizeAmount(changes.amount);
    if (nextAmount === null) {
      console.warn('벌칙 금액이 유효하지 않아 수정하지 않습니다:', changes.amount);
      return false;
    }

    if (nextName === current.name && nextAmount === current.amount) {
      return true;
    }

    writeRecords(records.map((r, i) => (i === index ? { ...r, name: nextName, amount: nextAmount } : r)));
    return true;
  }

  /**
   * 지정한 위치의 기록 1건을 삭제한다.
   * @param index getRecords() 가 돌려준 원본 위치
   * @returns 삭제에 성공하면 true
   */
  deleteRecord(index: number): boolean {
    const records = readRecords();
    if (!isValidIndex(index, records.length)) {
      console.warn('삭제할 벌칙 기록을 찾지 못했습니다:', index);
      return false;
    }

    writeRecords(records.filter((_, i) => i !== index));
    return true;
  }

  /** 이름별 당첨 횟수 / 누적 금액 요약 (누적 금액 내림차순). */
  getSummary(): PenaltySummaryRow[] {
    const map = new Map<string, PenaltySummaryRow>();
    for (const r of readRecords()) {
      const prev = map.get(r.name) ?? { name: r.name, count: 0, total: 0 };
      map.set(r.name, {
        name: r.name,
        count: prev.count + 1,
        total: prev.total + r.amount,
      });
    }
    return [...map.values()].sort((a, b) => b.total - a.total || b.count - a.count);
  }

  /** 전체 기록 삭제. */
  clear(): void {
    writeRecords([]);
  }
}

const penaltyStats = new PenaltyStats();
export default penaltyStats;
