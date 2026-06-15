class PredictionWorkspace
{
    private int _position;
    private int _velocity;
    private int _cooldown;
    private int _snapshot;
    private int _mode;

    public void Update(int input, bool teleport, bool reconcile)
    {
        if (input > 0) _velocity = _velocity + input;
        else if (input < 0) _velocity = _velocity - input;
        if (_cooldown > 0) _cooldown = _cooldown - 1;
        if (teleport) _position = _snapshot;
        if (reconcile && _position != _snapshot) _position = (_position + _snapshot) / 2;
        if (_mode == 1 || _mode == 2) _velocity = 0;
        _position = _position + _velocity;
    }
    public void AttackCooldown() => _cooldown = 10;
    public void StoreSnapshot(int value) => _snapshot = value;
    public void ChangeMode(int value) => _mode = value;
}
