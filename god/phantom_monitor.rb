env   = ENV['ENV'] || 'development'
project_root  = ENV['ROOT'] || "/home/deploy/readify"

God.watch do |w|
  w.dir      = project_root
  w.name     = "phantom_monitor"
  w.interval = 30.seconds
  w.start    = "bundle exec phantom_monitor -c #{project_root}/config.yml -e #{env}"
  w.log      = "#{project_root}/log/phantom_monitor.log"
  w.err_log  = "#{project_root}/log/phantom_monitor_error.log"

  # determine the state on startup
  w.transition(:init, { true => :up, false => :start }) do |on|
    on.condition(:process_running) do |c|
      c.running = true
    end
  end

  # determine when process has finished starting
  w.transition([:start, :restart], :up) do |on|
    on.condition(:process_running) do |c|
      c.running = true
      c.interval = 5.seconds
    end

    # failsafe
    on.condition(:tries) do |c|
      c.times = 5
      c.transition = :start
      c.interval = 5.seconds
    end
  end

  # start if process is not running
  w.transition(:up, :start) do |on|
    on.condition(:process_running) do |c|
      c.running = false
    end
  end
end