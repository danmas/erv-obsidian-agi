---
step_number: 7
parent_task: Установить OpenSSH uf Ubuntu
status: pending
---

# Шаг 7 Запустить ssh‑демон в переднем режиме – CMD usrsbinsshd

## 🧠 Соображения ИИ:

CMD [/usr/sbin/sshd -D] нужно добавить в Dockerfile после установки OpenSSH и копирования конфигурации → `CMD ["/usr/sbin/sshd", "-D"]`.  
Убедись, что файл /etc/ssh/sshd_config соответствует требованиям (ключи, разрешённые пользователи).  
Проверь, что директория `/run/sshd` существует и имеет права 755, иначе демона не запустится (`RUN mkdir -p /run/sshd`).  
Запускай контейнер через `docker run -d -p 22:22 <image>` и проверяй лог `docker logs <container>` – отсутствие ошибок и наличие строк «sshd: accepting connections » подтверждают успешный запуск.

## ✅ Критерии выполнения:

- [ ] Шаг выполнен согласно плану
- [ ] Результат проверен

---
**Родительская задача:** Установить OpenSSH uf Ubuntu
