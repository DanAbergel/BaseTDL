class BaseBot {
    constructor(name) {
        this.name = name;
    }

    getAssocWord(word) {
        throw new Error("getWord() must be implemented by the child class");
    }
}


class JokeBot extends BaseBot {
    constructor(name) {
        super(name);  // call BaseBot constructor
    }

    getAssocWord(word) {
        return "Here is a joke!";
    }
}

class SeriousBot extends  BaseBot {
    constructor(name) {
        super(name);
    }

    getAssocWord(word) {
        return "i'm serious!";
    }
}