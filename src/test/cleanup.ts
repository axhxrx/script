export type CleanupTask = () => Promise<void> | void;

export async function withCleanup<T>(
  fn: (registerCleanup: (task: CleanupTask) => void) => Promise<T>,
): Promise<T>
{
  const cleanupTasks: CleanupTask[] = [];

  try
  {
    return await fn((task) =>
    {
      cleanupTasks.push(task);
    });
  }
  finally
  {
    while (cleanupTasks.length > 0)
    {
      const task = cleanupTasks.pop();
      if (task)
      {
        await task();
      }
    }
  }
}
