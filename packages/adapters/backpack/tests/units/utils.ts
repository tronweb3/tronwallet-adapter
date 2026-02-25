export async function wait(ms = 100): Promise<void> {
    const p = new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
    jest.advanceTimersByTime(ms);
    await p;
}

export const ONE_SECOND = 1000;
export const CHECK_TIMEOUT = 3000;
