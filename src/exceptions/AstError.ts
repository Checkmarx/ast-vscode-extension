

class AstError extends Error {
    constructor(
		public code: number,
		msg: string) {
        super(msg);
    }
}

export default AstError;