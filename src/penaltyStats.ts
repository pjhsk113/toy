/**
 * 벌칙(당첨금액) 기록 및 통계 관리 모듈.
 *
 * 게임 종료(goal) 시 당첨자 1명과 벌칙 금액을 localStorage 에 누적 기록하고,
 * 이름별 누적 통계를 조회한다. 게임 로직과 독립적인 순수 추가 기능이다.
 */

const STORAGE_KEY = 'mbr_penalty_records';

export interface PenaltyRecord {
  name: string;
  amount: number;
  date: string; // ISO 8601
}

export interface PenaltySummaryRow {
  name: string;
  count: number;
  total: number;
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
    const safeAmount = Number.isFinite(amount) && amount >= 0 ? Math.floor(amount) : 0;

    const record: PenaltyRecord = {
      name: trimmed,
      amount: safeAmount,
      date: date.toISOString(),
    };

    writeRecords([...readRecords(), record]);
    return record;
  }

  /** 최신순으로 정렬된 전체 기록을 반환한다. */
  getRecords(): PenaltyRecord[] {
    return [...readRecords()].sort((a, b) => b.date.localeCompare(a.date));
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
