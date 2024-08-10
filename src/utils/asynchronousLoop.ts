export const asynchronousLoop = async (
  arrayLoop: Array<any>,
  callback: (itemLoop: any) => Promise<any>,
  sleepTime: number = 1000,
) => {
  for await (let i of handleLoop(arrayLoop, callback, sleepTime)) {
  }
};

async function* handleLoop(
  arrayLoop: Array<any>,
  callback: (itemLoop: Array<any>) => Promise<any>,
  sleepTime: number,
) {
  for (let i = 0; i < arrayLoop.length; i++) {
    yield new Promise((resolve) => {
      setTimeout(() => {
        callback(arrayLoop[i]).then(() => resolve(''));
      }, sleepTime);
    });
  }
}
