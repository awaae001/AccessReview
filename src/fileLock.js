const fileQueues = new Map();

/**
 * Processes the queue for a specific file path.
 * @param {string} filePath The path of the file.
 */
async function processQueue(filePath) {
    const queue = fileQueues.get(filePath);
    if (!queue || queue.isProcessing) {
        return;
    }

    if (queue.operations.length === 0) {
        fileQueues.delete(filePath);
        return;
    }

    queue.isProcessing = true;
    const { operation, resolve, reject } = queue.operations.shift();

    try {
        const result = await operation();
        resolve(result);
    } catch (error) {
        reject(error);
    } finally {
        queue.isProcessing = false;
        processQueue(filePath);
    }
}

/**
 * Enqueues a file operation to be executed sequentially.
 * @param {string} filePath The path of the file to operate on.
 * @param {() => Promise<any>} operation The async operation to perform on the file.
 * @returns {Promise<any>} A promise that resolves with the result of the operation.
 */
function enqueueOperation(filePath, operation) {
    return new Promise((resolve, reject) => {
        if (!fileQueues.has(filePath)) {
            fileQueues.set(filePath, {
                operations: [],
                isProcessing: false,
            });
        }

        const queue = fileQueues.get(filePath);
        queue.operations.push({ operation, resolve, reject });

        if (!queue.isProcessing) {
            processQueue(filePath);
        }
    });
}

module.exports = {
    enqueueOperation,
};