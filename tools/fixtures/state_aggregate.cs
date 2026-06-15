using System.Collections.Generic;

class StateAggregate
{
    private readonly Queue<int> _input = new Queue<int>();
    private readonly Dictionary<int, int> _history = new Dictionary<int, int>();
    private int _position;
    private int _velocity;
    private int _mode;
    private int _cooldown;

    public void Enqueue(int value) => _input.Enqueue(value);
    public int Dequeue() => _input.Dequeue();
    public void Record(int tick) => _history[tick] = _position;
    public void SetMotion(int position, int velocity)
    {
        _position = position;
        _velocity = velocity;
    }
    public void SetMode(int mode) => _mode = mode;
    public void SetCooldown(int cooldown) => _cooldown = cooldown;
    public void Decay() => _cooldown = _cooldown - 1;
}
