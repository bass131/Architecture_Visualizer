class BranchWorker { public void Apply() { } }

class HybridCoordinator
{
    private readonly BranchWorker _worker = new BranchWorker();
    private int _mode;
    private int _value;
    private int _limit;

    public void Run(int input)
    {
        _worker.Apply();
        if (input > 0) _value = input;
        else _value = -input;
        if (_value > _limit) _value = _limit;
        if (_mode == 1 && _value > 2) _worker.Apply();
        if (_mode == 2 || _value == 0) _worker.Apply();
        while (_value > 10) _value = _value - 1;
    }
    public void SetMode(int mode) => _mode = mode;
    public void SetLimit(int limit) => _limit = limit;
}
