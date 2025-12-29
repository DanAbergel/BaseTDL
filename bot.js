class BaseBot {
    constructor(name) {
        this.name = name;
    }

    getAssocWord(word) {
        throw new Error("getWord() must be implemented by the child class");
    }
}


class JokeBot extends BaseBot {
    constructor(seed) {
        super("JokeBot");  // call BaseBot constructor
        this.seed = seed;
    }

    getAssocWord(word) {
        return "Here is a joke!";
    }
}

class SeriousBot extends  BaseBot {
    constructor(seed) {
        super("SeriousBot");
        this.seed = seed;
    }

    getAssocWord(word) {
        return "i'm serious!";
    }
}