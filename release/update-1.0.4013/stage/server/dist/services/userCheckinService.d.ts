export declare function getCheckinDateString(date?: Date): string;
export declare function normalizeCheckinPoints(value: unknown): number;
export declare function buildCheckinMonthRange(monthInput?: string, now?: Date): {
    month: string;
    start: string;
    end: string;
};
export declare function getUserCheckinStatus(userId: number): Promise<{
    today: string;
    checkedInToday: boolean;
    totalDays: number;
    totalPoints: number;
}>;
export declare function getUserCheckinMonth(userId: number, monthInput?: string): Promise<{
    records: {
        checkinDate: string;
        points: number;
        createdAt: any;
    }[];
    month: string;
    start: string;
    end: string;
}>;
export declare function checkinToday(userId: number, pointsValue?: unknown): Promise<{
    pointsEarned: number;
    alreadyChecked: boolean;
    today: string;
    checkedInToday: boolean;
    totalDays: number;
    totalPoints: number;
}>;
//# sourceMappingURL=userCheckinService.d.ts.map