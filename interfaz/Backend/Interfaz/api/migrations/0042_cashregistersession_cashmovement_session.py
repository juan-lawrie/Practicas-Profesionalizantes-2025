import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0041_order_payment_difference'),
    ]

    operations = [
        migrations.CreateModel(
            name='CashRegisterSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('opened_at', models.DateTimeField(auto_now_add=True)),
                ('opening_balance', models.DecimalField(decimal_places=2, max_digits=12)),
                ('closed_at', models.DateTimeField(blank=True, null=True)),
                ('closing_balance', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('is_open', models.BooleanField(default=True)),
                ('opened_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='opened_cash_sessions', to=settings.AUTH_USER_MODEL)),
                ('closed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='closed_cash_sessions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-opened_at'],
                'constraints': [
                    models.UniqueConstraint(condition=models.Q(('is_open', True)), fields=('is_open',), name='unique_open_cash_register_session'),
                ],
            },
        ),
        migrations.AddField(
            model_name='cashmovement',
            name='session',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='movements', to='api.cashregistersession'),
        ),
    ]
